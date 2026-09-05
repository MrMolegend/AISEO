import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import { icpCriteriaSchema, type IcpInput } from '@/schemas/icp';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Ideal customer profiles.
 *
 * Workspace-shared, not per-user: an ICP a manager writes is the one a rep's
 * campaign runs against, so reads are workspace-wide and writes are gated by
 * role at the route layer. createdBy is provenance, not ownership.
 */

export interface IcpRecord extends IcpInput {
  id: string;
  createdBy: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IcpStore {
  readonly name: string;
  create(input: IcpInput, createdBy: string): Promise<IcpRecord>;
  update(id: string, input: IcpInput): Promise<IcpRecord | null>;
  setArchived(id: string, archived: boolean): Promise<boolean>;
  get(id: string): Promise<IcpRecord | null>;
  list(options?: { includeArchived?: boolean }): Promise<IcpRecord[]>;
}

type IcpRow = Database['public']['Tables']['icps']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: IcpRow): IcpRecord {
  return {
    id: row.id,
    createdBy: row.created_by,
    name: row.name,
    territoryKeys: row.territory_keys,
    segmentKeys: row.segment_keys,
    minEvidenceLevel: row.min_evidence_level as IcpRecord['minEvidenceLevel'],
    maxAccounts: row.max_accounts,
    maxContactsPerAccount: row.max_contacts_per_account,
    researchBudgetUnits: row.research_budget_units,
    // Stored jsonb re-validated on the way out; unknown shapes surface as
    // errors rather than flowing into campaign planning.
    criteria: icpCriteriaSchema.parse(row.criteria ?? {}),
    archivedAt: row.archived_at ? toIsoUtc(row.archived_at) : null,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

function inputToRow(input: IcpInput) {
  return {
    name: input.name,
    territory_keys: input.territoryKeys,
    segment_keys: input.segmentKeys,
    min_evidence_level: input.minEvidenceLevel,
    max_accounts: input.maxAccounts,
    max_contacts_per_account: input.maxContactsPerAccount,
    research_budget_units: input.researchBudgetUnits,
    criteria: input.criteria as never,
  };
}

export class SupabaseIcpStore implements IcpStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(input: IcpInput, createdBy: string): Promise<IcpRecord> {
    const { data, error } = await this.client
      .from('icps')
      .insert({ ...inputToRow(input), created_by: createdBy })
      .select('*')
      .single<IcpRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the profile', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async update(id: string, input: IcpInput): Promise<IcpRecord | null> {
    const { data, error } = await this.client
      .from('icps')
      .update(inputToRow(input))
      .eq('id', id)
      .select('*')
      .maybeSingle<IcpRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the profile', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async setArchived(id: string, archived: boolean): Promise<boolean> {
    const { data, error } = await this.client
      .from('icps')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id)
      .select('id')
      .maybeSingle<{ id: string }>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the profile', {
        cause: error,
      });
    }
    return Boolean(data);
  }

  async get(id: string): Promise<IcpRecord | null> {
    const { data, error } = await this.client
      .from('icps')
      .select('*')
      .eq('id', id)
      .maybeSingle<IcpRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the profile', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async list(options: { includeArchived?: boolean } = {}): Promise<IcpRecord[]> {
    let query = this.client
      .from('icps')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(100);
    if (!options.includeArchived) query = query.is('archived_at', null);
    const { data, error } = await query;
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list the profiles', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as IcpRow));
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  icps: Map<string, IcpRecord>;
}

const MEMORY_KEY = Symbol.for('alt.icp-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { icps: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryIcpStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryIcpStore implements IcpStore {
  readonly name = 'memory';

  async create(input: IcpInput, createdBy: string): Promise<IcpRecord> {
    const now = new Date().toISOString();
    const record: IcpRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdBy,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    memory().icps.set(record.id, record);
    return record;
  }

  async update(id: string, input: IcpInput): Promise<IcpRecord | null> {
    const existing = memory().icps.get(id);
    if (!existing) return null;
    const next: IcpRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    memory().icps.set(id, next);
    return next;
  }

  async setArchived(id: string, archived: boolean): Promise<boolean> {
    const existing = memory().icps.get(id);
    if (!existing) return false;
    existing.archivedAt = archived ? new Date().toISOString() : null;
    existing.updatedAt = new Date().toISOString();
    return true;
  }

  async get(id: string): Promise<IcpRecord | null> {
    return memory().icps.get(id) ?? null;
  }

  async list(options: { includeArchived?: boolean } = {}): Promise<IcpRecord[]> {
    return [...memory().icps.values()]
      .filter((icp) => options.includeArchived || icp.archivedAt === null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

let cached: IcpStore | null = null;

export async function getIcpStore(): Promise<IcpStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseIcpStore(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
    : new MemoryIcpStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetIcpStoreCache(): void {
  cached = null;
}
