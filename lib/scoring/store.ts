import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { ComputedScore, ScoreComponent } from '@/lib/scoring/compute';
import type { ScoringWeights } from '@/schemas/alt-config';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Score persistence. One current score per account; recompute replaces the
 * computed half and leaves any override standing beside it. An override
 * never edits `total` — the computed number survives so the decomposition
 * stays honest about what the arithmetic said.
 */

export interface ScoreRecord {
  accountId: string;
  total: number;
  components: ScoreComponent[];
  weightsUsed: ScoringWeights;
  computedAt: string;
  overrideTotal: number | null;
  overrideReason: string | null;
  overriddenBy: string | null;
  overriddenAt: string | null;
}

export interface ScoreStore {
  readonly name: string;
  upsertComputed(accountId: string, computed: ComputedScore): Promise<ScoreRecord>;
  get(accountId: string): Promise<ScoreRecord | null>;
  setOverride(
    accountId: string,
    override: { total: number; reason: string; by: string } | null,
  ): Promise<ScoreRecord | null>;
}

type Row = Database['public']['Tables']['account_scores']['Row'];

function rowToRecord(row: Row): ScoreRecord {
  return {
    accountId: row.account_id,
    total: row.total,
    components: (row.components ?? []) as unknown as ScoreComponent[],
    weightsUsed: (row.weights_used ?? {}) as ScoringWeights,
    computedAt: row.computed_at,
    overrideTotal: row.override_total,
    overrideReason: row.override_reason,
    overriddenBy: row.overridden_by,
    overriddenAt: row.overridden_at,
  };
}

export class SupabaseScoreStore implements ScoreStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsertComputed(accountId: string, computed: ComputedScore): Promise<ScoreRecord> {
    const existing = await this.get(accountId);
    const { data, error } = await this.client
      .from('account_scores')
      .upsert(
        {
          account_id: accountId,
          total: computed.total,
          components: computed.components as never,
          weights_used: computed.weightsUsed as never,
          computed_at: computed.computedAt,
          // Recompute preserves a standing override untouched.
          override_total: existing?.overrideTotal ?? null,
          override_reason: existing?.overrideReason ?? null,
          overridden_by: existing?.overriddenBy ?? null,
          overridden_at: existing?.overriddenAt ?? null,
        },
        { onConflict: 'account_id' },
      )
      .select('*')
      .single<Row>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the score', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async get(accountId: string): Promise<ScoreRecord | null> {
    const { data, error } = await this.client
      .from('account_scores')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle<Row>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the score', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async setOverride(
    accountId: string,
    override: { total: number; reason: string; by: string } | null,
  ): Promise<ScoreRecord | null> {
    const { data, error } = await this.client
      .from('account_scores')
      .update(
        override
          ? {
              override_total: override.total,
              override_reason: override.reason,
              overridden_by: override.by,
              overridden_at: new Date().toISOString(),
            }
          : {
              override_total: null,
              override_reason: null,
              overridden_by: null,
              overridden_at: null,
            },
      )
      .eq('account_id', accountId)
      .select('*')
      .maybeSingle<Row>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the override', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  scores: Map<string, ScoreRecord>;
}

const MEMORY_KEY = Symbol.for('alt.score-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { scores: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryScoreStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryScoreStore implements ScoreStore {
  readonly name = 'memory';

  async upsertComputed(accountId: string, computed: ComputedScore): Promise<ScoreRecord> {
    const existing = memory().scores.get(accountId);
    const record: ScoreRecord = {
      accountId,
      total: computed.total,
      components: computed.components,
      weightsUsed: computed.weightsUsed,
      computedAt: computed.computedAt,
      overrideTotal: existing?.overrideTotal ?? null,
      overrideReason: existing?.overrideReason ?? null,
      overriddenBy: existing?.overriddenBy ?? null,
      overriddenAt: existing?.overriddenAt ?? null,
    };
    memory().scores.set(accountId, record);
    return record;
  }

  async get(accountId: string): Promise<ScoreRecord | null> {
    return memory().scores.get(accountId) ?? null;
  }

  async setOverride(
    accountId: string,
    override: { total: number; reason: string; by: string } | null,
  ): Promise<ScoreRecord | null> {
    const existing = memory().scores.get(accountId);
    if (!existing) return null;
    if (override) {
      existing.overrideTotal = override.total;
      existing.overrideReason = override.reason;
      existing.overriddenBy = override.by;
      existing.overriddenAt = new Date().toISOString();
    } else {
      existing.overrideTotal = null;
      existing.overrideReason = null;
      existing.overriddenBy = null;
      existing.overriddenAt = null;
    }
    return existing;
  }
}

let cached: ScoreStore | null = null;

export async function getScoreStore(): Promise<ScoreStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseScoreStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryScoreStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetScoreStoreCache(): void {
  cached = null;
}
