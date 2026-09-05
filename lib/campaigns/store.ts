import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { CampaignInput, CampaignStatus, RunStage } from '@/schemas/campaign';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Campaigns and their discovery runs.
 *
 * Reliability discipline mirrors the report job store: every stage
 * transition touches the heartbeat, the stall sweep reads a partial index,
 * and the database itself enforces one live run per campaign — the
 * duplicate-active guard is a unique index, not a check the application
 * could race past.
 */

export interface CampaignRecord extends CampaignInput {
  id: string;
  createdBy: string | null;
  status: CampaignStatus;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RunCheckpoint {
  /** Account ids the enrichment stage has finished. */
  enriched?: string[];
  /** Account ids the contact stage has finished. */
  contacted?: string[];
}

export interface CampaignRunRecord {
  id: string;
  campaignId: string;
  startedBy: string | null;
  status: 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  stage: RunStage;
  errorCode: string | null;
  attemptCount: number;
  heartbeatAt: string | null;
  unitsBudget: number;
  unitsSpent: number;
  accountsFound: number;
  accountsQualified: number;
  contactsFound: number;
  checkpoint: RunCheckpoint;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface RunTotals {
  unitsSpent?: number;
  accountsFound?: number;
  accountsQualified?: number;
  contactsFound?: number;
}

export interface CampaignStore {
  readonly name: string;
  create(input: CampaignInput, createdBy: string): Promise<CampaignRecord>;
  get(id: string): Promise<CampaignRecord | null>;
  list(options?: { statuses?: CampaignStatus[] }): Promise<CampaignRecord[]>;
  setStatus(id: string, status: CampaignStatus): Promise<boolean>;

  /** Creates the run, or returns the existing active one (duplicate guard). */
  createRun(
    campaignId: string,
    startedBy: string,
    unitsBudget: number,
  ): Promise<{ run: CampaignRunRecord; duplicate: boolean }>;
  getRun(id: string): Promise<CampaignRunRecord | null>;
  latestRun(campaignId: string): Promise<CampaignRunRecord | null>;
  setRunStage(id: string, stage: RunStage): Promise<void>;
  updateRun(id: string, patch: RunTotals & { checkpoint?: RunCheckpoint }): Promise<void>;
  finishRun(
    id: string,
    status: 'completed' | 'partial' | 'failed' | 'cancelled',
    errorCode?: string | null,
  ): Promise<void>;
  listStaleRuns(cutoffIso: string): Promise<CampaignRunRecord[]>;
  /** Workspace-wide research units spent since the given instant. */
  unitsSpentSince(sinceIso: string): Promise<number>;
}

type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
type RunRow = Database['public']['Tables']['campaign_runs']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function campaignRowToRecord(row: CampaignRow): CampaignRecord {
  return {
    id: row.id,
    createdBy: row.created_by,
    ownerId: row.owner_id,
    icpId: row.icp_id ?? '',
    name: row.name,
    objective: row.objective,
    territoryKeys: row.territory_keys,
    language: row.language as CampaignRecord['language'],
    status: row.status as CampaignStatus,
    maxAccounts: row.max_accounts,
    maxContactsPerAccount: row.max_contacts_per_account,
    budgetUnits: row.budget_units,
    startedAt: row.started_at ? toIsoUtc(row.started_at) : null,
    finishedAt: row.finished_at ? toIsoUtc(row.finished_at) : null,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

function runRowToRecord(row: RunRow): CampaignRunRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    startedBy: row.started_by,
    status: row.status as CampaignRunRecord['status'],
    stage: row.stage as RunStage,
    errorCode: row.error_code,
    attemptCount: row.attempt_count,
    heartbeatAt: row.heartbeat_at ? toIsoUtc(row.heartbeat_at) : null,
    unitsBudget: row.units_budget,
    unitsSpent: row.units_spent,
    accountsFound: row.accounts_found,
    accountsQualified: row.accounts_qualified,
    contactsFound: row.contacts_found,
    checkpoint: (row.checkpoint ?? {}) as RunCheckpoint,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
    finishedAt: row.finished_at ? toIsoUtc(row.finished_at) : null,
  };
}

export class SupabaseCampaignStore implements CampaignStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(input: CampaignInput, createdBy: string): Promise<CampaignRecord> {
    const { data, error } = await this.client
      .from('campaigns')
      .insert({
        created_by: createdBy,
        owner_id: input.ownerId,
        icp_id: input.icpId,
        name: input.name,
        objective: input.objective,
        territory_keys: input.territoryKeys,
        language: input.language,
        max_accounts: input.maxAccounts,
        max_contacts_per_account: input.maxContactsPerAccount,
        budget_units: input.budgetUnits,
      })
      .select('*')
      .single<CampaignRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the campaign', {
        cause: error,
      });
    }
    return campaignRowToRecord(data);
  }

  async get(id: string): Promise<CampaignRecord | null> {
    const { data, error } = await this.client
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle<CampaignRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the campaign', {
        cause: error,
      });
    }
    return data ? campaignRowToRecord(data) : null;
  }

  async list(options: { statuses?: CampaignStatus[] } = {}): Promise<CampaignRecord[]> {
    let query = this.client
      .from('campaigns')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (options.statuses && options.statuses.length > 0) {
      query = query.in('status', options.statuses);
    }
    const { data, error } = await query;
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list campaigns', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => campaignRowToRecord(row as CampaignRow));
  }

  async setStatus(id: string, status: CampaignStatus): Promise<boolean> {
    const patch: Database['public']['Tables']['campaigns']['Update'] = { status };
    if (status === 'running') patch.started_at = new Date().toISOString();
    if (['completed', 'partial', 'failed', 'cancelled'].includes(status)) {
      patch.finished_at = new Date().toISOString();
    }
    const { data, error } = await this.client
      .from('campaigns')
      .update(patch)
      .eq('id', id)
      .select('id')
      .maybeSingle<{ id: string }>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the campaign', {
        cause: error,
      });
    }
    return Boolean(data);
  }

  async createRun(
    campaignId: string,
    startedBy: string,
    unitsBudget: number,
  ): Promise<{ run: CampaignRunRecord; duplicate: boolean }> {
    const { data, error } = await this.client
      .from('campaign_runs')
      .insert({
        campaign_id: campaignId,
        started_by: startedBy,
        status: 'queued',
        stage: 'queued',
        units_budget: unitsBudget,
        heartbeat_at: new Date().toISOString(),
      })
      .select('*')
      .single<RunRow>();

    if (error) {
      // 23505: the partial unique index — an active run already exists.
      if ((error as { code?: string }).code === '23505') {
        const existing = await this.activeRun(campaignId);
        if (existing) return { run: existing, duplicate: true };
      }
      throw new PlatformError('STORAGE_ERROR', 'Could not start the run', {
        cause: error,
      });
    }
    return { run: runRowToRecord(data!), duplicate: false };
  }

  private async activeRun(campaignId: string): Promise<CampaignRunRecord | null> {
    const { data } = await this.client
      .from('campaign_runs')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'running'])
      .maybeSingle<RunRow>();
    return data ? runRowToRecord(data) : null;
  }

  async getRun(id: string): Promise<CampaignRunRecord | null> {
    const { data, error } = await this.client
      .from('campaign_runs')
      .select('*')
      .eq('id', id)
      .maybeSingle<RunRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the run', {
        cause: error,
      });
    }
    return data ? runRowToRecord(data) : null;
  }

  async latestRun(campaignId: string): Promise<CampaignRunRecord | null> {
    const { data, error } = await this.client
      .from('campaign_runs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<RunRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the run', {
        cause: error,
      });
    }
    return data ? runRowToRecord(data) : null;
  }

  async setRunStage(id: string, stage: RunStage): Promise<void> {
    // Filtered on non-terminal status so a stage write can never resurrect
    // a run that was cancelled or repaired while the engine was working.
    const { error } = await this.client
      .from('campaign_runs')
      .update({
        stage,
        status: 'running',
        heartbeat_at: new Date().toISOString(),
      })
      .eq('id', id)
      .in('status', ['queued', 'running']);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not advance the run', {
        cause: error,
      });
    }
  }

  async updateRun(
    id: string,
    patch: RunTotals & { checkpoint?: RunCheckpoint },
  ): Promise<void> {
    const row: Database['public']['Tables']['campaign_runs']['Update'] = {
      heartbeat_at: new Date().toISOString(),
    };
    if (patch.unitsSpent !== undefined) row.units_spent = patch.unitsSpent;
    if (patch.accountsFound !== undefined) row.accounts_found = patch.accountsFound;
    if (patch.accountsQualified !== undefined) {
      row.accounts_qualified = patch.accountsQualified;
    }
    if (patch.contactsFound !== undefined) row.contacts_found = patch.contactsFound;
    if (patch.checkpoint !== undefined) row.checkpoint = patch.checkpoint as never;

    const { error } = await this.client.from('campaign_runs').update(row).eq('id', id);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the run', {
        cause: error,
      });
    }
  }

  async finishRun(
    id: string,
    status: 'completed' | 'partial' | 'failed' | 'cancelled',
    errorCode: string | null = null,
  ): Promise<void> {
    // Terminal states are final: a late 'completed' from an engine that
    // lost a cancellation race must not overwrite it.
    const { error } = await this.client
      .from('campaign_runs')
      .update({
        status,
        stage: 'done',
        error_code: errorCode,
        finished_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .eq('id', id)
      .in('status', ['queued', 'running']);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not finish the run', {
        cause: error,
      });
    }
  }

  async listStaleRuns(cutoffIso: string): Promise<CampaignRunRecord[]> {
    const { data, error } = await this.client
      .from('campaign_runs')
      .select('*')
      .in('status', ['queued', 'running'])
      .or(
        `heartbeat_at.lt.${cutoffIso},and(heartbeat_at.is.null,created_at.lt.${cutoffIso})`,
      )
      .limit(50);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list stale runs', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => runRowToRecord(row as RunRow));
  }

  async unitsSpentSince(sinceIso: string): Promise<number> {
    const { data, error } = await this.client
      .from('campaign_runs')
      .select('units_spent')
      .gte('created_at', sinceIso);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read spend', {
        cause: error,
      });
    }
    return (data ?? []).reduce(
      (sum, row) => sum + ((row as { units_spent: number }).units_spent ?? 0),
      0,
    );
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  campaigns: Map<string, CampaignRecord>;
  runs: Map<string, CampaignRunRecord>;
}

const MEMORY_KEY = Symbol.for('alt.campaign-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { campaigns: new Map(), runs: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryCampaignStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryCampaignStore implements CampaignStore {
  readonly name = 'memory';

  async create(input: CampaignInput, createdBy: string): Promise<CampaignRecord> {
    const now = new Date().toISOString();
    const record: CampaignRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdBy,
      status: 'draft',
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    memory().campaigns.set(record.id, record);
    return record;
  }

  async get(id: string): Promise<CampaignRecord | null> {
    return memory().campaigns.get(id) ?? null;
  }

  async list(options: { statuses?: CampaignStatus[] } = {}): Promise<CampaignRecord[]> {
    return [...memory().campaigns.values()]
      .filter(
        (campaign) =>
          !options.statuses ||
          options.statuses.length === 0 ||
          options.statuses.includes(campaign.status),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async setStatus(id: string, status: CampaignStatus): Promise<boolean> {
    const campaign = memory().campaigns.get(id);
    if (!campaign) return false;
    campaign.status = status;
    campaign.updatedAt = new Date().toISOString();
    if (status === 'running') campaign.startedAt = campaign.updatedAt;
    if (['completed', 'partial', 'failed', 'cancelled'].includes(status)) {
      campaign.finishedAt = campaign.updatedAt;
    }
    return true;
  }

  async createRun(
    campaignId: string,
    startedBy: string,
    unitsBudget: number,
  ): Promise<{ run: CampaignRunRecord; duplicate: boolean }> {
    const active = [...memory().runs.values()].find(
      (run) =>
        run.campaignId === campaignId && ['queued', 'running'].includes(run.status),
    );
    if (active) return { run: active, duplicate: true };

    const now = new Date().toISOString();
    const run: CampaignRunRecord = {
      id: crypto.randomUUID(),
      campaignId,
      startedBy,
      status: 'queued',
      stage: 'queued',
      errorCode: null,
      attemptCount: 1,
      heartbeatAt: now,
      unitsBudget,
      unitsSpent: 0,
      accountsFound: 0,
      accountsQualified: 0,
      contactsFound: 0,
      checkpoint: {},
      createdAt: now,
      updatedAt: now,
      finishedAt: null,
    };
    memory().runs.set(run.id, run);
    return { run, duplicate: false };
  }

  async getRun(id: string): Promise<CampaignRunRecord | null> {
    return memory().runs.get(id) ?? null;
  }

  async latestRun(campaignId: string): Promise<CampaignRunRecord | null> {
    return (
      [...memory().runs.values()]
        .filter((run) => run.campaignId === campaignId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }

  async setRunStage(id: string, stage: RunStage): Promise<void> {
    const run = memory().runs.get(id);
    if (!run || !['queued', 'running'].includes(run.status)) return;
    run.stage = stage;
    run.status = 'running';
    run.heartbeatAt = new Date().toISOString();
    run.updatedAt = run.heartbeatAt;
  }

  async updateRun(
    id: string,
    patch: RunTotals & { checkpoint?: RunCheckpoint },
  ): Promise<void> {
    const run = memory().runs.get(id);
    if (!run) return;
    if (patch.unitsSpent !== undefined) run.unitsSpent = patch.unitsSpent;
    if (patch.accountsFound !== undefined) run.accountsFound = patch.accountsFound;
    if (patch.accountsQualified !== undefined) {
      run.accountsQualified = patch.accountsQualified;
    }
    if (patch.contactsFound !== undefined) run.contactsFound = patch.contactsFound;
    if (patch.checkpoint !== undefined) run.checkpoint = patch.checkpoint;
    run.heartbeatAt = new Date().toISOString();
    run.updatedAt = run.heartbeatAt;
  }

  async finishRun(
    id: string,
    status: 'completed' | 'partial' | 'failed' | 'cancelled',
    errorCode: string | null = null,
  ): Promise<void> {
    const run = memory().runs.get(id);
    if (!run || !['queued', 'running'].includes(run.status)) return;
    run.status = status;
    run.stage = 'done';
    run.errorCode = errorCode;
    run.finishedAt = new Date().toISOString();
    run.heartbeatAt = run.finishedAt;
    run.updatedAt = run.finishedAt;
  }

  async listStaleRuns(cutoffIso: string): Promise<CampaignRunRecord[]> {
    return [...memory().runs.values()].filter(
      (run) =>
        ['queued', 'running'].includes(run.status) &&
        (run.heartbeatAt ?? run.createdAt) < cutoffIso,
    );
  }

  async unitsSpentSince(sinceIso: string): Promise<number> {
    return [...memory().runs.values()]
      .filter((run) => run.createdAt >= sinceIso)
      .reduce((sum, run) => sum + run.unitsSpent, 0);
  }
}

let cached: CampaignStore | null = null;

export async function getCampaignStore(): Promise<CampaignStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseCampaignStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryCampaignStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetCampaignStoreCache(): void {
  cached = null;
}
