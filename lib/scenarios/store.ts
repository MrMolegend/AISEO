import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Saved Scenario Lab what-ifs.
 *
 * A row stores only the user's assumption values — never report content and
 * never computed results. Results are recomputed from the stored report plus
 * these assumptions on every render, which is what keeps a scenario honest: it
 * can never disagree with the arithmetic that claims to produce it.
 *
 * Names are unique per report (the schema enforces it), so saving under an
 * existing name is an update — "the cautious one" stays one scenario however
 * many times it is refined.
 */

export interface ReportScenarioRecord {
  id: string;
  userId: string;
  jobId: string;
  name: string;
  assumptions: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReportScenarioStore {
  readonly name: string;
  /** Insert-or-update by (jobId, name), owner-scoped. */
  upsert(
    userId: string,
    jobId: string,
    name: string,
    assumptions: Record<string, unknown>,
  ): Promise<ReportScenarioRecord>;
  listForJob(userId: string, jobId: string): Promise<ReportScenarioRecord[]>;
  delete(id: string, userId: string): Promise<boolean>;
}

type ScenarioRow = Database['public']['Tables']['report_scenarios']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: ScenarioRow): ReportScenarioRecord {
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    name: row.name,
    assumptions: (row.assumptions ?? {}) as Record<string, unknown>,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

export class SupabaseReportScenarioStore implements ReportScenarioStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsert(
    userId: string,
    jobId: string,
    name: string,
    assumptions: Record<string, unknown>,
  ): Promise<ReportScenarioRecord> {
    // Try the update first: the common case for a named scenario is
    // refinement. Filtered on the owner, like every write here.
    const { data: updated, error: updateError } = await this.client
      .from('report_scenarios')
      .update({ assumptions: assumptions as Json })
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .eq('name', name)
      .select('*')
      .maybeSingle<ScenarioRow>();

    if (updateError) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the scenario', {
        cause: updateError,
      });
    }
    if (updated) return rowToRecord(updated);

    const { data, error } = await this.client
      .from('report_scenarios')
      .insert({
        user_id: userId,
        job_id: jobId,
        name,
        assumptions: assumptions as Json,
      })
      .select('*')
      .single<ScenarioRow>();

    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the scenario', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async listForJob(userId: string, jobId: string): Promise<ReportScenarioRecord[]> {
    const { data, error } = await this.client
      .from('report_scenarios')
      .select('*')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list your scenarios', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as ScenarioRow));
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('report_scenarios')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not delete the scenario', {
        cause: error,
      });
    }
    return Boolean(data);
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  scenarios: Map<string, ReportScenarioRecord>;
}

const MEMORY_KEY = Symbol.for('corridor.scenario-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { scenarios: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryScenarioStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryReportScenarioStore implements ReportScenarioStore {
  readonly name = 'memory';

  async upsert(
    userId: string,
    jobId: string,
    name: string,
    assumptions: Record<string, unknown>,
  ): Promise<ReportScenarioRecord> {
    for (const scenario of memory().scenarios.values()) {
      if (
        scenario.userId === userId &&
        scenario.jobId === jobId &&
        scenario.name === name
      ) {
        scenario.assumptions = assumptions;
        scenario.updatedAt = new Date().toISOString();
        return scenario;
      }
    }
    const now = new Date().toISOString();
    const record: ReportScenarioRecord = {
      id: crypto.randomUUID(),
      userId,
      jobId,
      name,
      assumptions,
      createdAt: now,
      updatedAt: now,
    };
    memory().scenarios.set(record.id, record);
    return record;
  }

  async listForJob(userId: string, jobId: string): Promise<ReportScenarioRecord[]> {
    return [...memory().scenarios.values()]
      .filter((scenario) => scenario.userId === userId && scenario.jobId === jobId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 50);
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const scenario = memory().scenarios.get(id);
    if (!scenario || scenario.userId !== userId) return false;
    memory().scenarios.delete(id);
    return true;
  }
}

let cached: ReportScenarioStore | null = null;

export async function getReportScenarioStore(): Promise<ReportScenarioStore> {
  if (cached) return cached;

  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseReportScenarioStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryReportScenarioStore();

  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetReportScenarioStoreCache(): void {
  cached = null;
}
