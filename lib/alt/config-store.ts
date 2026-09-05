import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import {
  CONFIG_SCHEMAS,
  DEFAULT_BUDGET_CAPS,
  DEFAULT_SCORING_WEIGHTS,
  type BrandInput,
  type ConfigKey,
  type FactSource,
} from '@/schemas/alt-config';
import { ALT_FACTS, GCC_MARKETS, UAE_EMIRATES } from '@/config/alt';
import { DEFAULT_PLAYBOOKS } from '@/schemas/pipeline';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';
import type { z } from 'zod';

/**
 * The commercial configuration store: keyed config, the brand catalogue,
 * and territories.
 *
 * Reads fall back to sourced defaults when nothing has been saved — the
 * proof points seeded from the build specification carry that source and
 * their recording date, so nothing ever renders as an unsourced fact. Every
 * value is validated against its key's schema in both directions: the
 * database cannot hold a shape the application will not re-read.
 */

export type ConfigValue<K extends ConfigKey> = z.infer<(typeof CONFIG_SCHEMAS)[K]>;

export interface BrandRecord extends BrandInput {
  id: string;
  recordedOn: string;
  createdAt: string;
  updatedAt: string;
}

export interface TerritoryRecord {
  key: string;
  name: string;
  kind: 'country' | 'emirate' | 'city' | 'region';
  parentKey: string | null;
  active: boolean;
}

export interface AltConfigStore {
  readonly name: string;
  getConfig<K extends ConfigKey>(key: K): Promise<ConfigValue<K>>;
  setConfig<K extends ConfigKey>(
    key: K,
    value: ConfigValue<K>,
    updatedBy: string,
    source?: FactSource,
  ): Promise<void>;
  listBrands(options?: { includeInactive?: boolean }): Promise<BrandRecord[]>;
  createBrand(input: BrandInput, createdBy: string): Promise<BrandRecord>;
  updateBrand(id: string, input: BrandInput): Promise<BrandRecord | null>;
  listTerritories(): Promise<TerritoryRecord[]>;
}

/** Defaults, each carrying its provenance in the value itself where the shape allows. */
export function defaultConfigValue<K extends ConfigKey>(key: K): ConfigValue<K> {
  switch (key) {
    case 'proof_points':
      return ALT_FACTS.map((fact) => ({
        text: fact.claim,
        source: fact.source,
        recordedOn: fact.recordedOn,
      })) as ConfigValue<K>;
    case 'prohibited_claims':
      return [] as unknown as ConfigValue<K>;
    case 'outreach_rules':
      return CONFIG_SCHEMAS.outreach_rules.parse({}) as ConfigValue<K>;
    case 'scoring_weights':
      return { ...DEFAULT_SCORING_WEIGHTS } as ConfigValue<K>;
    case 'budget_caps':
      return { ...DEFAULT_BUDGET_CAPS } as ConfigValue<K>;
    case 'playbooks':
      return DEFAULT_PLAYBOOKS.map((playbook) => ({
        ...playbook,
        steps: playbook.steps.map((step) => ({ ...step })),
      })) as ConfigValue<K>;
    default: {
      const exhausted: never = key;
      throw new PlatformError('INVALID_INPUT', `Unknown config key ${String(exhausted)}`);
    }
  }
}

function defaultTerritories(): TerritoryRecord[] {
  const countries: TerritoryRecord[] = GCC_MARKETS.map((market) => ({
    key: market.code,
    name: market.name,
    kind: 'country',
    parentKey: null,
    active: true,
  }));
  const emirateKey: Record<string, string> = {
    'Abu Dhabi': 'AE-AZ',
    Dubai: 'AE-DU',
    Sharjah: 'AE-SH',
    Ajman: 'AE-AJ',
    'Umm Al Quwain': 'AE-UQ',
    'Ras Al Khaimah': 'AE-RK',
    Fujairah: 'AE-FU',
  };
  const emirates: TerritoryRecord[] = UAE_EMIRATES.map((name) => ({
    key: emirateKey[name]!,
    name,
    kind: 'emirate',
    parentKey: 'AE',
    active: true,
  }));
  return [...countries, ...emirates];
}

type BrandRow = Database['public']['Tables']['alt_brands']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function brandRowToRecord(row: BrandRow): BrandRecord {
  return {
    id: row.id,
    name: row.name,
    categories: row.categories,
    positioning: row.positioning as BrandRecord['positioning'],
    exclusivityNotes: row.exclusivity_notes ?? '',
    source: row.source as FactSource,
    recordedOn: row.recorded_on,
    active: row.active,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

function brandInputToRow(input: BrandInput) {
  return {
    name: input.name,
    categories: input.categories,
    positioning: input.positioning,
    exclusivity_notes: input.exclusivityNotes || null,
    source: input.source,
    recorded_on: input.recordedOn ?? new Date().toISOString().slice(0, 10),
    active: input.active,
  };
}

export class SupabaseAltConfigStore implements AltConfigStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async getConfig<K extends ConfigKey>(key: K): Promise<ConfigValue<K>> {
    const { data, error } = await this.client
      .from('alt_config')
      .select('value')
      .eq('key', key)
      .maybeSingle<{ value: unknown }>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the configuration', {
        cause: error,
      });
    }
    if (!data) return defaultConfigValue(key);

    const parsed = CONFIG_SCHEMAS[key].safeParse(data.value);
    if (!parsed.success) {
      // A stored value the schema no longer accepts is a defect to surface,
      // not silently paper over with defaults that contradict what an
      // administrator saved.
      throw new PlatformError(
        'STORAGE_ERROR',
        `Stored configuration for ${key} is invalid`,
      );
    }
    return parsed.data as ConfigValue<K>;
  }

  async setConfig<K extends ConfigKey>(
    key: K,
    value: ConfigValue<K>,
    updatedBy: string,
    source: FactSource = 'alt_admin',
  ): Promise<void> {
    const parsed = CONFIG_SCHEMAS[key].parse(value);
    const { error } = await this.client.from('alt_config').upsert(
      {
        key,
        value: parsed as never,
        source,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the configuration', {
        cause: error,
      });
    }
  }

  async listBrands(options: { includeInactive?: boolean } = {}): Promise<BrandRecord[]> {
    let query = this.client.from('alt_brands').select('*').order('name');
    if (!options.includeInactive) query = query.eq('active', true);
    const { data, error } = await query;
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list the catalogue', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => brandRowToRecord(row as BrandRow));
  }

  async createBrand(input: BrandInput, createdBy: string): Promise<BrandRecord> {
    const { data, error } = await this.client
      .from('alt_brands')
      .insert({ ...brandInputToRow(input), created_by: createdBy })
      .select('*')
      .single<BrandRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the brand', {
        cause: error,
      });
    }
    return brandRowToRecord(data);
  }

  async updateBrand(id: string, input: BrandInput): Promise<BrandRecord | null> {
    const { data, error } = await this.client
      .from('alt_brands')
      .update(brandInputToRow(input))
      .eq('id', id)
      .select('*')
      .maybeSingle<BrandRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the brand', {
        cause: error,
      });
    }
    return data ? brandRowToRecord(data) : null;
  }

  async listTerritories(): Promise<TerritoryRecord[]> {
    const { data, error } = await this.client
      .from('alt_territories')
      .select('*')
      .eq('active', true)
      .order('key');
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list territories', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => ({
      key: row.key,
      name: row.name,
      kind: row.kind as TerritoryRecord['kind'],
      parentKey: row.parent_key,
      active: row.active,
    }));
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  config: Map<string, unknown>;
  brands: Map<string, BrandRecord>;
  territories: TerritoryRecord[];
}

const MEMORY_KEY = Symbol.for('alt.config-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) {
    holder[MEMORY_KEY] = {
      config: new Map(),
      brands: new Map(),
      territories: defaultTerritories(),
    };
  }
  return holder[MEMORY_KEY]!;
}

export function resetMemoryAltConfigStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryAltConfigStore implements AltConfigStore {
  readonly name = 'memory';

  async getConfig<K extends ConfigKey>(key: K): Promise<ConfigValue<K>> {
    const stored = memory().config.get(key);
    if (stored === undefined) return defaultConfigValue(key);
    return CONFIG_SCHEMAS[key].parse(stored) as ConfigValue<K>;
  }

  async setConfig<K extends ConfigKey>(key: K, value: ConfigValue<K>): Promise<void> {
    memory().config.set(key, CONFIG_SCHEMAS[key].parse(value));
  }

  async listBrands(options: { includeInactive?: boolean } = {}): Promise<BrandRecord[]> {
    return [...memory().brands.values()]
      .filter((brand) => options.includeInactive || brand.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createBrand(input: BrandInput): Promise<BrandRecord> {
    const duplicate = [...memory().brands.values()].some(
      (brand) => brand.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (duplicate) {
      throw new PlatformError('INVALID_INPUT', 'A brand with that name already exists.');
    }
    const now = new Date().toISOString();
    const record: BrandRecord = {
      ...input,
      exclusivityNotes: input.exclusivityNotes,
      id: crypto.randomUUID(),
      recordedOn: input.recordedOn ?? now.slice(0, 10),
      createdAt: now,
      updatedAt: now,
    };
    memory().brands.set(record.id, record);
    return record;
  }

  async updateBrand(id: string, input: BrandInput): Promise<BrandRecord | null> {
    const existing = memory().brands.get(id);
    if (!existing) return null;
    const next: BrandRecord = {
      ...existing,
      ...input,
      recordedOn: input.recordedOn ?? existing.recordedOn,
      updatedAt: new Date().toISOString(),
    };
    memory().brands.set(id, next);
    return next;
  }

  async listTerritories(): Promise<TerritoryRecord[]> {
    return memory().territories.filter((territory) => territory.active);
  }
}

let cached: AltConfigStore | null = null;

export async function getAltConfigStore(): Promise<AltConfigStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseAltConfigStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryAltConfigStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetAltConfigStoreCache(): void {
  cached = null;
}
