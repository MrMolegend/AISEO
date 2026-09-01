import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Action workspace storage.
 *
 * Rows begin as copies of a report's recommended actions (or are written by
 * hand) and then belong to the customer. The report's plan never changes;
 * these rows never stop changing. That split is the point: model output stays
 * inspectable exactly as it was produced, and execution state has somewhere
 * honest to live.
 *
 * Import idempotency is structural, not procedural: the database's partial
 * unique index over (user_id, job_id, source_action_id) makes a second import
 * of the same recommendation a conflict the store treats as "already there".
 * Retrying a half-failed import completes it; it cannot double it.
 */

export const ACTION_PHASES = ['days-1-30', 'days-31-60', 'days-61-90', 'later'] as const;
export type ActionPhase = (typeof ACTION_PHASES)[number];

export const ACTION_STATUSES = ['todo', 'in-progress', 'done', 'deferred'] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_PRIORITIES = ['critical', 'high', 'normal'] as const;
export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

/** A pointer from an action back to what justified it. */
export interface ActionEvidenceLink {
  label: string;
  url?: string;
  sectionId?: string;
}

export interface ActionItemRecord {
  id: string;
  userId: string;
  jobId: string | null;
  profileId: string | null;
  sourceActionId: string | null;
  title: string;
  rationale: string | null;
  phase: ActionPhase;
  status: ActionStatus;
  priority: ActionPriority;
  ownerLabel: string | null;
  dueDate: string | null;
  notes: string | null;
  sortOrder: number;
  evidence: ActionEvidenceLink[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionInput {
  jobId?: string | null;
  profileId?: string | null;
  sourceActionId?: string | null;
  title: string;
  rationale?: string | null;
  phase: ActionPhase;
  status?: ActionStatus;
  priority?: ActionPriority;
  ownerLabel?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  sortOrder?: number;
  evidence?: ActionEvidenceLink[];
}

export interface UpdateActionInput {
  title?: string;
  rationale?: string | null;
  phase?: ActionPhase;
  status?: ActionStatus;
  priority?: ActionPriority;
  ownerLabel?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  sortOrder?: number;
}

export interface ActionItemStore {
  readonly name: string;
  /** Insert; on an import-uniqueness conflict returns the existing row. */
  create(userId: string, input: CreateActionInput): Promise<ActionItemRecord>;
  update(
    id: string,
    userId: string,
    input: UpdateActionInput,
  ): Promise<ActionItemRecord | null>;
  delete(id: string, userId: string): Promise<boolean>;
  getForUser(id: string, userId: string): Promise<ActionItemRecord | null>;
  listForUser(
    userId: string,
    options?: { jobId?: string; limit?: number },
  ): Promise<ActionItemRecord[]>;
}

type ActionRow = Database['public']['Tables']['action_items']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function narrow<T extends readonly string[]>(
  values: T,
  value: string,
  fallback: T[number],
): T[number] {
  return (values as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function rowToRecord(row: ActionRow): ActionItemRecord {
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    profileId: row.profile_id,
    sourceActionId: row.source_action_id,
    title: row.title,
    rationale: row.rationale,
    phase: narrow(ACTION_PHASES, row.phase, 'later'),
    status: narrow(ACTION_STATUSES, row.status, 'todo'),
    priority: narrow(ACTION_PRIORITIES, row.priority, 'normal'),
    ownerLabel: row.owner_label,
    dueDate: row.due_date,
    notes: row.notes,
    sortOrder: row.sort_order,
    evidence: Array.isArray(row.evidence)
      ? (row.evidence as unknown as ActionEvidenceLink[])
      : [],
    completedAt: row.completed_at ? toIsoUtc(row.completed_at) : null,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

export class SupabaseActionItemStore implements ActionItemStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(userId: string, input: CreateActionInput): Promise<ActionItemRecord> {
    const { data, error } = await this.client
      .from('action_items')
      .insert({
        user_id: userId,
        job_id: input.jobId ?? null,
        profile_id: input.profileId ?? null,
        source_action_id: input.sourceActionId ?? null,
        title: input.title,
        rationale: input.rationale ?? null,
        phase: input.phase,
        status: input.status ?? 'todo',
        priority: input.priority ?? 'normal',
        owner_label: input.ownerLabel ?? null,
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
        sort_order: input.sortOrder ?? 0,
        evidence: (input.evidence ?? []) as unknown as Json,
      })
      .select('*')
      .single<ActionRow>();

    if (error) {
      // The import index fired: this recommendation is already in the
      // workspace. Return the existing row so a retried import converges.
      if (error.code === UNIQUE_VIOLATION && input.sourceActionId && input.jobId) {
        const { data: existing } = await this.client
          .from('action_items')
          .select('*')
          .eq('user_id', userId)
          .eq('job_id', input.jobId)
          .eq('source_action_id', input.sourceActionId)
          .maybeSingle<ActionRow>();
        if (existing) return rowToRecord(existing);
      }
      throw new PlatformError('STORAGE_ERROR', 'Could not create the action', {
        cause: error,
      });
    }
    if (!data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the action');
    }
    return rowToRecord(data);
  }

  async update(
    id: string,
    userId: string,
    input: UpdateActionInput,
  ): Promise<ActionItemRecord | null> {
    const patch: Database['public']['Tables']['action_items']['Update'] = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.rationale !== undefined) patch.rationale = input.rationale;
    if (input.phase !== undefined) patch.phase = input.phase;
    if (input.status !== undefined) {
      patch.status = input.status;
      patch.completed_at = input.status === 'done' ? new Date().toISOString() : null;
    }
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.ownerLabel !== undefined) patch.owner_label = input.ownerLabel;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;

    const { data, error } = await this.client
      .from('action_items')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle<ActionRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the action', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('action_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not delete the action', {
        cause: error,
      });
    }
    return Boolean(data);
  }

  async getForUser(id: string, userId: string): Promise<ActionItemRecord | null> {
    const { data, error } = await this.client
      .from('action_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle<ActionRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the action', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async listForUser(
    userId: string,
    options: { jobId?: string; limit?: number } = {},
  ): Promise<ActionItemRecord[]> {
    let query = this.client
      .from('action_items')
      .select('*')
      .eq('user_id', userId)
      .order('phase', { ascending: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(Math.min(options.limit ?? 200, 500));

    if (options.jobId) query = query.eq('job_id', options.jobId);

    const { data, error } = await query;
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list your actions', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as ActionRow));
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  actions: Map<string, ActionItemRecord>;
}

const MEMORY_KEY = Symbol.for('corridor.action-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { actions: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryActionStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

const PHASE_ORDER: Record<ActionPhase, number> = {
  'days-1-30': 0,
  'days-31-60': 1,
  'days-61-90': 2,
  later: 3,
};

export class MemoryActionItemStore implements ActionItemStore {
  readonly name = 'memory';

  async create(userId: string, input: CreateActionInput): Promise<ActionItemRecord> {
    if (input.sourceActionId && input.jobId) {
      for (const action of memory().actions.values()) {
        if (
          action.userId === userId &&
          action.jobId === input.jobId &&
          action.sourceActionId === input.sourceActionId
        ) {
          return action;
        }
      }
    }
    const now = new Date().toISOString();
    const record: ActionItemRecord = {
      id: crypto.randomUUID(),
      userId,
      jobId: input.jobId ?? null,
      profileId: input.profileId ?? null,
      sourceActionId: input.sourceActionId ?? null,
      title: input.title,
      rationale: input.rationale ?? null,
      phase: input.phase,
      status: input.status ?? 'todo',
      priority: input.priority ?? 'normal',
      ownerLabel: input.ownerLabel ?? null,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? 0,
      evidence: input.evidence ?? [],
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    memory().actions.set(record.id, record);
    return record;
  }

  async update(
    id: string,
    userId: string,
    input: UpdateActionInput,
  ): Promise<ActionItemRecord | null> {
    const action = memory().actions.get(id);
    if (!action || action.userId !== userId) return null;
    if (input.title !== undefined) action.title = input.title;
    if (input.rationale !== undefined) action.rationale = input.rationale;
    if (input.phase !== undefined) action.phase = input.phase;
    if (input.status !== undefined) {
      action.status = input.status;
      action.completedAt = input.status === 'done' ? new Date().toISOString() : null;
    }
    if (input.priority !== undefined) action.priority = input.priority;
    if (input.ownerLabel !== undefined) action.ownerLabel = input.ownerLabel;
    if (input.dueDate !== undefined) action.dueDate = input.dueDate;
    if (input.notes !== undefined) action.notes = input.notes;
    if (input.sortOrder !== undefined) action.sortOrder = input.sortOrder;
    action.updatedAt = new Date().toISOString();
    return action;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const action = memory().actions.get(id);
    if (!action || action.userId !== userId) return false;
    memory().actions.delete(id);
    return true;
  }

  async getForUser(id: string, userId: string): Promise<ActionItemRecord | null> {
    const action = memory().actions.get(id);
    return action && action.userId === userId ? action : null;
  }

  async listForUser(
    userId: string,
    options: { jobId?: string; limit?: number } = {},
  ): Promise<ActionItemRecord[]> {
    return [...memory().actions.values()]
      .filter(
        (action) =>
          action.userId === userId && (!options.jobId || action.jobId === options.jobId),
      )
      .sort(
        (a, b) =>
          PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] ||
          a.sortOrder - b.sortOrder ||
          a.createdAt.localeCompare(b.createdAt),
      )
      .slice(0, Math.min(options.limit ?? 200, 500));
  }
}

let cached: ActionItemStore | null = null;

export async function getActionItemStore(): Promise<ActionItemStore> {
  if (cached) return cached;

  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseActionItemStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryActionItemStore();

  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetActionItemStoreCache(): void {
  cached = null;
}
