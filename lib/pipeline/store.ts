import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Pipeline history, activities, tasks and saved views — the working
 * memory of the sales motion. History and activities are append-only by
 * grant; tasks update but never delete (dropped is a status, and the
 * record of having dropped something is part of the story).
 */

export interface StageChangeRecord {
  id: number;
  accountId: string;
  fromStage: string | null;
  toStage: string;
  changedBy: string | null;
  note: string;
  createdAt: string;
}

export interface ActivityRecord {
  id: string;
  accountId: string;
  contactId: string | null;
  authorId: string | null;
  kind: string;
  body: string;
  private: boolean;
  happenedAt: string;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  accountId: string | null;
  assigneeId: string | null;
  createdBy: string | null;
  title: string;
  detail: string | null;
  dueOn: string | null;
  status: 'open' | 'done' | 'dropped';
  playbookKey: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface SavedViewRecord {
  id: string;
  userId: string;
  name: string;
  path: string;
  createdAt: string;
}

export interface PipelineStore {
  readonly name: string;
  recordStageChange(change: {
    accountId: string;
    fromStage: string | null;
    toStage: string;
    changedBy: string;
    note: string;
  }): Promise<StageChangeRecord>;
  historyForAccount(accountId: string): Promise<StageChangeRecord[]>;
  /** Recent history across all accounts, newest first — the insights feed. */
  allHistory(limit: number): Promise<StageChangeRecord[]>;

  addActivity(activity: {
    accountId: string;
    contactId: string | null;
    authorId: string;
    kind: string;
    body: string;
    private: boolean;
  }): Promise<ActivityRecord>;
  activitiesForAccount(accountId: string, viewerId: string): Promise<ActivityRecord[]>;

  createTask(task: {
    accountId: string | null;
    assigneeId: string | null;
    createdBy: string;
    title: string;
    detail: string | null;
    dueOn: string | null;
    playbookKey?: string | null;
  }): Promise<{ task: TaskRecord; existed: boolean }>;
  updateTaskStatus(
    id: string,
    status: 'open' | 'done' | 'dropped',
  ): Promise<TaskRecord | null>;
  tasksForAssignee(assigneeId: string, status?: 'open' | 'done'): Promise<TaskRecord[]>;
  tasksForAccount(accountId: string): Promise<TaskRecord[]>;

  saveView(view: {
    userId: string;
    name: string;
    path: string;
  }): Promise<SavedViewRecord>;
  deleteView(id: string, userId: string): Promise<boolean>;
  viewsForUser(userId: string): Promise<SavedViewRecord[]>;
}

type HistoryRow = Database['public']['Tables']['pipeline_history']['Row'];
type ActivityRow = Database['public']['Tables']['activities']['Row'];
type TaskRow = Database['public']['Tables']['sales_tasks']['Row'];
type ViewRow = Database['public']['Tables']['saved_views']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function historyRowToRecord(row: HistoryRow): StageChangeRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    changedBy: row.changed_by,
    note: row.note,
    createdAt: toIsoUtc(row.created_at),
  };
}

function activityRowToRecord(row: ActivityRow): ActivityRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    contactId: row.contact_id,
    authorId: row.author_id,
    kind: row.kind,
    body: row.body,
    private: row.private,
    happenedAt: toIsoUtc(row.happened_at),
    createdAt: toIsoUtc(row.created_at),
  };
}

function taskRowToRecord(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    assigneeId: row.assignee_id,
    createdBy: row.created_by,
    title: row.title,
    detail: row.detail,
    dueOn: row.due_on,
    status: row.status as TaskRecord['status'],
    playbookKey: row.playbook_key,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
    completedAt: row.completed_at ? toIsoUtc(row.completed_at) : null,
  };
}

export class SupabasePipelineStore implements PipelineStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async recordStageChange(change: {
    accountId: string;
    fromStage: string | null;
    toStage: string;
    changedBy: string;
    note: string;
  }): Promise<StageChangeRecord> {
    const { data, error } = await this.client
      .from('pipeline_history')
      .insert({
        account_id: change.accountId,
        from_stage: change.fromStage,
        to_stage: change.toStage,
        changed_by: change.changedBy,
        note: change.note,
      })
      .select('*')
      .single<HistoryRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not record the change', {
        cause: error,
      });
    }
    return historyRowToRecord(data);
  }

  async historyForAccount(accountId: string): Promise<StageChangeRecord[]> {
    const { data, error } = await this.client
      .from('pipeline_history')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the history', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => historyRowToRecord(row as HistoryRow));
  }

  async allHistory(limit: number): Promise<StageChangeRecord[]> {
    const { data, error } = await this.client
      .from('pipeline_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the history', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => historyRowToRecord(row as HistoryRow));
  }

  async addActivity(activity: {
    accountId: string;
    contactId: string | null;
    authorId: string;
    kind: string;
    body: string;
    private: boolean;
  }): Promise<ActivityRecord> {
    const { data, error } = await this.client
      .from('activities')
      .insert({
        account_id: activity.accountId,
        contact_id: activity.contactId,
        author_id: activity.authorId,
        kind: activity.kind,
        body: activity.body,
        private: activity.private,
      })
      .select('*')
      .single<ActivityRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the activity', {
        cause: error,
      });
    }
    return activityRowToRecord(data);
  }

  async activitiesForAccount(
    accountId: string,
    viewerId: string,
  ): Promise<ActivityRecord[]> {
    const { data, error } = await this.client
      .from('activities')
      .select('*')
      .eq('account_id', accountId)
      .or(`private.eq.false,author_id.eq.${viewerId}`)
      .order('happened_at', { ascending: false })
      .limit(200);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read activities', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => activityRowToRecord(row as ActivityRow));
  }

  async createTask(task: {
    accountId: string | null;
    assigneeId: string | null;
    createdBy: string;
    title: string;
    detail: string | null;
    dueOn: string | null;
    playbookKey?: string | null;
  }): Promise<{ task: TaskRecord; existed: boolean }> {
    const { data, error } = await this.client
      .from('sales_tasks')
      .insert({
        account_id: task.accountId,
        assignee_id: task.assigneeId,
        created_by: task.createdBy,
        title: task.title,
        detail: task.detail,
        due_on: task.dueOn,
        playbook_key: task.playbookKey ?? null,
      })
      .select('*')
      .single<TaskRow>();

    if (error) {
      // 23505: the playbook fingerprint — the task already exists.
      if ((error as { code?: string }).code === '23505' && task.playbookKey) {
        const { data: existing } = await this.client
          .from('sales_tasks')
          .select('*')
          .eq('account_id', task.accountId!)
          .eq('playbook_key', task.playbookKey)
          .eq('title', task.title)
          .maybeSingle<TaskRow>();
        if (existing) return { task: taskRowToRecord(existing), existed: true };
      }
      throw new PlatformError('STORAGE_ERROR', 'Could not save the task', {
        cause: error,
      });
    }
    return { task: taskRowToRecord(data!), existed: false };
  }

  async updateTaskStatus(
    id: string,
    status: 'open' | 'done' | 'dropped',
  ): Promise<TaskRecord | null> {
    const { data, error } = await this.client
      .from('sales_tasks')
      .update({
        status,
        completed_at: status === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle<TaskRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the task', {
        cause: error,
      });
    }
    return data ? taskRowToRecord(data) : null;
  }

  async tasksForAssignee(
    assigneeId: string,
    status: 'open' | 'done' = 'open',
  ): Promise<TaskRecord[]> {
    const { data, error } = await this.client
      .from('sales_tasks')
      .select('*')
      .eq('assignee_id', assigneeId)
      .eq('status', status)
      .order('due_on', { ascending: true, nullsFirst: false })
      .limit(200);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list tasks', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => taskRowToRecord(row as TaskRow));
  }

  async tasksForAccount(accountId: string): Promise<TaskRecord[]> {
    const { data, error } = await this.client
      .from('sales_tasks')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list tasks', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => taskRowToRecord(row as TaskRow));
  }

  async saveView(view: {
    userId: string;
    name: string;
    path: string;
  }): Promise<SavedViewRecord> {
    const { data, error } = await this.client
      .from('saved_views')
      .upsert(
        { user_id: view.userId, name: view.name, path: view.path },
        { onConflict: 'user_id,name' },
      )
      .select('*')
      .single<ViewRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the view', {
        cause: error,
      });
    }
    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      path: data.path,
      createdAt: toIsoUtc(data.created_at),
    };
  }

  async deleteView(id: string, userId: string): Promise<boolean> {
    const { data } = await this.client
      .from('saved_views')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle<{ id: string }>();
    return Boolean(data);
  }

  async viewsForUser(userId: string): Promise<SavedViewRecord[]> {
    const { data, error } = await this.client
      .from('saved_views')
      .select('*')
      .eq('user_id', userId)
      .order('name')
      .limit(50);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list views', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => {
      const view = row as ViewRow;
      return {
        id: view.id,
        userId: view.user_id,
        name: view.name,
        path: view.path,
        createdAt: toIsoUtc(view.created_at),
      };
    });
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  history: StageChangeRecord[];
  nextHistoryId: number;
  activities: ActivityRecord[];
  tasks: Map<string, TaskRecord>;
  views: Map<string, SavedViewRecord>;
}

const MEMORY_KEY = Symbol.for('alt.pipeline-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) {
    holder[MEMORY_KEY] = {
      history: [],
      nextHistoryId: 1,
      activities: [],
      tasks: new Map(),
      views: new Map(),
    };
  }
  return holder[MEMORY_KEY]!;
}

export function resetMemoryPipelineStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryPipelineStore implements PipelineStore {
  readonly name = 'memory';

  async recordStageChange(change: {
    accountId: string;
    fromStage: string | null;
    toStage: string;
    changedBy: string;
    note: string;
  }): Promise<StageChangeRecord> {
    const state = memory();
    const record: StageChangeRecord = {
      id: state.nextHistoryId++,
      accountId: change.accountId,
      fromStage: change.fromStage,
      toStage: change.toStage,
      changedBy: change.changedBy,
      note: change.note,
      createdAt: new Date().toISOString(),
    };
    state.history.push(record);
    return record;
  }

  async historyForAccount(accountId: string): Promise<StageChangeRecord[]> {
    return [...memory().history]
      .filter((change) => change.accountId === accountId)
      .reverse();
  }

  async allHistory(limit: number): Promise<StageChangeRecord[]> {
    return [...memory().history].reverse().slice(0, limit);
  }

  async addActivity(activity: {
    accountId: string;
    contactId: string | null;
    authorId: string;
    kind: string;
    body: string;
    private: boolean;
  }): Promise<ActivityRecord> {
    const record: ActivityRecord = {
      id: crypto.randomUUID(),
      accountId: activity.accountId,
      contactId: activity.contactId,
      authorId: activity.authorId,
      kind: activity.kind,
      body: activity.body,
      private: activity.private,
      happenedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    memory().activities.push(record);
    return record;
  }

  async activitiesForAccount(
    accountId: string,
    viewerId: string,
  ): Promise<ActivityRecord[]> {
    return [...memory().activities]
      .filter(
        (activity) =>
          activity.accountId === accountId &&
          (!activity.private || activity.authorId === viewerId),
      )
      .reverse();
  }

  async createTask(task: {
    accountId: string | null;
    assigneeId: string | null;
    createdBy: string;
    title: string;
    detail: string | null;
    dueOn: string | null;
    playbookKey?: string | null;
  }): Promise<{ task: TaskRecord; existed: boolean }> {
    if (task.playbookKey && task.accountId) {
      const existing = [...memory().tasks.values()].find(
        (candidate) =>
          candidate.accountId === task.accountId &&
          candidate.playbookKey === task.playbookKey &&
          candidate.title === task.title,
      );
      if (existing) return { task: existing, existed: true };
    }
    const now = new Date().toISOString();
    const record: TaskRecord = {
      id: crypto.randomUUID(),
      accountId: task.accountId,
      assigneeId: task.assigneeId,
      createdBy: task.createdBy,
      title: task.title,
      detail: task.detail,
      dueOn: task.dueOn,
      status: 'open',
      playbookKey: task.playbookKey ?? null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    memory().tasks.set(record.id, record);
    return { task: record, existed: false };
  }

  async updateTaskStatus(
    id: string,
    status: 'open' | 'done' | 'dropped',
  ): Promise<TaskRecord | null> {
    const task = memory().tasks.get(id);
    if (!task) return null;
    task.status = status;
    task.completedAt = status === 'done' ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
    return task;
  }

  async tasksForAssignee(
    assigneeId: string,
    status: 'open' | 'done' = 'open',
  ): Promise<TaskRecord[]> {
    return [...memory().tasks.values()]
      .filter((task) => task.assigneeId === assigneeId && task.status === status)
      .sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'));
  }

  async tasksForAccount(accountId: string): Promise<TaskRecord[]> {
    return [...memory().tasks.values()]
      .filter((task) => task.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveView(view: {
    userId: string;
    name: string;
    path: string;
  }): Promise<SavedViewRecord> {
    const existing = [...memory().views.values()].find(
      (candidate) => candidate.userId === view.userId && candidate.name === view.name,
    );
    if (existing) {
      existing.path = view.path;
      return existing;
    }
    const record: SavedViewRecord = {
      id: crypto.randomUUID(),
      userId: view.userId,
      name: view.name,
      path: view.path,
      createdAt: new Date().toISOString(),
    };
    memory().views.set(record.id, record);
    return record;
  }

  async deleteView(id: string, userId: string): Promise<boolean> {
    const view = memory().views.get(id);
    if (!view || view.userId !== userId) return false;
    return memory().views.delete(id);
  }

  async viewsForUser(userId: string): Promise<SavedViewRecord[]> {
    return [...memory().views.values()]
      .filter((view) => view.userId === userId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

let cached: PipelineStore | null = null;

export async function getPipelineStore(): Promise<PipelineStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabasePipelineStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryPipelineStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetPipelineStoreCache(): void {
  cached = null;
}
