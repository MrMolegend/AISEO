import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Research draft storage.
 *
 * The intake autosaves into these rows so unfinished work survives the
 * browser, the device and the session. Two rules carry the design:
 *
 *   · **Stale writes lose loudly.** Every save states the revision it read.
 *     The update is filtered on that revision, so a write from a tab that is
 *     behind matches zero rows — the store reports DRAFT_CONFLICT and the tab
 *     is told to reload rather than silently clobbering the newer copy. This
 *     is compare-and-set in one statement, not read-then-write.
 *
 *   · **A draft is state until submission and provenance after.** markSubmitted
 *     flips status and records the job the draft became; nothing edits a
 *     submitted draft. The job's own input snapshot is authoritative from
 *     then on.
 *
 * Payloads are opaque JSON here. The route layer bounds and shape-checks them
 * loosely on save (a draft is allowed to be incomplete and even invalid) and
 * validates strictly only at submission — the same strictness gradient a
 * paper form has.
 */

export type DraftStatus = 'active' | 'submitted' | 'discarded';

export interface ResearchDraftRecord {
  id: string;
  userId: string;
  profileId: string | null;
  payload: Record<string, unknown>;
  revision: number;
  status: DraftStatus;
  submittedJobId: string | null;
  autosavedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchDraftStore {
  readonly name: string;
  create(
    userId: string,
    payload: Record<string, unknown>,
    profileId?: string | null,
  ): Promise<ResearchDraftRecord>;
  /**
   * Compare-and-set save. Succeeds only when `expectedRevision` matches the
   * stored row; throws DRAFT_CONFLICT otherwise. Returns the new revision.
   */
  save(
    id: string,
    userId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
    profileId?: string | null,
  ): Promise<ResearchDraftRecord>;
  getForUser(id: string, userId: string): Promise<ResearchDraftRecord | null>;
  /** Most recently touched active draft, for "pick up where you left off". */
  latestActive(userId: string): Promise<ResearchDraftRecord | null>;
  listForUser(userId: string, limit?: number): Promise<ResearchDraftRecord[]>;
  markSubmitted(id: string, userId: string, jobId: string): Promise<void>;
  discard(id: string, userId: string): Promise<boolean>;
}

type DraftRow = Database['public']['Tables']['research_drafts']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function isDraftStatus(value: string): value is DraftStatus {
  return value === 'active' || value === 'submitted' || value === 'discarded';
}

function rowToRecord(row: DraftRow): ResearchDraftRecord {
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    revision: row.revision,
    status: isDraftStatus(row.status) ? row.status : 'discarded',
    submittedJobId: row.submitted_job_id,
    autosavedAt: toIsoUtc(row.autosaved_at),
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

export class SupabaseResearchDraftStore implements ResearchDraftStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(
    userId: string,
    payload: Record<string, unknown>,
    profileId: string | null = null,
  ): Promise<ResearchDraftRecord> {
    const { data, error } = await this.client
      .from('research_drafts')
      .insert({
        user_id: userId,
        profile_id: profileId,
        payload: payload as Json,
        revision: 1,
        status: 'active',
      })
      .select('*')
      .single<DraftRow>();

    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the draft', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async save(
    id: string,
    userId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
    profileId?: string | null,
  ): Promise<ResearchDraftRecord> {
    // The revision filter is the concurrency control: a stale writer matches
    // nothing and learns why, instead of overwriting a newer copy.
    const { data, error } = await this.client
      .from('research_drafts')
      .update({
        payload: payload as Json,
        revision: expectedRevision + 1,
        autosaved_at: new Date().toISOString(),
        ...(profileId !== undefined ? { profile_id: profileId } : {}),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('revision', expectedRevision)
      .select('*')
      .maybeSingle<DraftRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the draft', {
        cause: error,
      });
    }
    if (!data) {
      // Zero rows matched: stale revision, someone else's draft, or a draft
      // that already left the active state. The caller reloads either way.
      throw new PlatformError(
        'DRAFT_CONFLICT',
        'The draft changed since this tab read it',
      );
    }
    return rowToRecord(data);
  }

  async getForUser(id: string, userId: string): Promise<ResearchDraftRecord | null> {
    const { data, error } = await this.client
      .from('research_drafts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle<DraftRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the draft', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async latestActive(userId: string): Promise<ResearchDraftRecord | null> {
    const { data, error } = await this.client
      .from('research_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle<DraftRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not look for a saved draft', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async listForUser(userId: string, limit = 20): Promise<ResearchDraftRecord[]> {
    const { data, error } = await this.client
      .from('research_drafts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(Math.min(limit, 50));

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list your drafts', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as DraftRow));
  }

  async markSubmitted(id: string, userId: string, jobId: string): Promise<void> {
    const { error } = await this.client
      .from('research_drafts')
      .update({ status: 'submitted', submitted_job_id: jobId })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'active');

    // Losing this write costs bookkeeping, not the submission itself.
    if (error) return;
  }

  async discard(id: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('research_drafts')
      .update({ status: 'discarded' })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not discard the draft', {
        cause: error,
      });
    }
    return Boolean(data);
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  drafts: Map<string, ResearchDraftRecord>;
}

const MEMORY_KEY = Symbol.for('corridor.draft-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { drafts: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryDraftStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryResearchDraftStore implements ResearchDraftStore {
  readonly name = 'memory';

  async create(
    userId: string,
    payload: Record<string, unknown>,
    profileId: string | null = null,
  ): Promise<ResearchDraftRecord> {
    const now = new Date().toISOString();
    const record: ResearchDraftRecord = {
      id: crypto.randomUUID(),
      userId,
      profileId,
      payload,
      revision: 1,
      status: 'active',
      submittedJobId: null,
      autosavedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    memory().drafts.set(record.id, record);
    return record;
  }

  async save(
    id: string,
    userId: string,
    payload: Record<string, unknown>,
    expectedRevision: number,
    profileId?: string | null,
  ): Promise<ResearchDraftRecord> {
    const draft = memory().drafts.get(id);
    if (
      !draft ||
      draft.userId !== userId ||
      draft.status !== 'active' ||
      draft.revision !== expectedRevision
    ) {
      throw new PlatformError(
        'DRAFT_CONFLICT',
        'The draft changed since this tab read it',
      );
    }
    draft.payload = payload;
    draft.revision = expectedRevision + 1;
    if (profileId !== undefined) draft.profileId = profileId;
    draft.autosavedAt = new Date().toISOString();
    draft.updatedAt = draft.autosavedAt;
    return draft;
  }

  async getForUser(id: string, userId: string): Promise<ResearchDraftRecord | null> {
    const draft = memory().drafts.get(id);
    return draft && draft.userId === userId ? draft : null;
  }

  async latestActive(userId: string): Promise<ResearchDraftRecord | null> {
    return (
      [...memory().drafts.values()]
        .filter((draft) => draft.userId === userId && draft.status === 'active')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    );
  }

  async listForUser(userId: string, limit = 20): Promise<ResearchDraftRecord[]> {
    return [...memory().drafts.values()]
      .filter((draft) => draft.userId === userId && draft.status === 'active')
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.min(limit, 50));
  }

  async markSubmitted(id: string, userId: string, jobId: string): Promise<void> {
    const draft = memory().drafts.get(id);
    if (!draft || draft.userId !== userId || draft.status !== 'active') return;
    draft.status = 'submitted';
    draft.submittedJobId = jobId;
    draft.updatedAt = new Date().toISOString();
  }

  async discard(id: string, userId: string): Promise<boolean> {
    const draft = memory().drafts.get(id);
    if (!draft || draft.userId !== userId || draft.status !== 'active') return false;
    draft.status = 'discarded';
    draft.updatedAt = new Date().toISOString();
    return true;
  }
}

let cached: ResearchDraftStore | null = null;

export async function getResearchDraftStore(): Promise<ResearchDraftStore> {
  if (cached) return cached;

  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseResearchDraftStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryResearchDraftStore();

  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetResearchDraftStoreCache(): void {
  cached = null;
}
