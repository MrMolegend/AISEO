import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Report feedback storage.
 *
 * One verdict per user per report, revisable — the table's primary key is the
 * upsert constraint, so route code cannot accumulate duplicates however it is
 * retried. Comments are bounded, treated as untrusted text everywhere they
 * render, and visible only to their author and to the aggregate the admin
 * console reads.
 */

export const FEEDBACK_CATEGORIES = [
  'accuracy',
  'evidence',
  'depth',
  'clarity',
  'actionability',
  'other',
] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface ReportFeedbackRecord {
  userId: string;
  jobId: string;
  useful: boolean;
  category: FeedbackCategory | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackAggregate {
  jobId: string;
  usefulCount: number;
  notUsefulCount: number;
  categories: Partial<Record<FeedbackCategory, number>>;
}

export interface ReportFeedbackStore {
  readonly name: string;
  upsert(
    userId: string,
    jobId: string,
    input: { useful: boolean; category: FeedbackCategory | null; comment: string | null },
  ): Promise<ReportFeedbackRecord>;
  getForUser(userId: string, jobId: string): Promise<ReportFeedbackRecord | null>;
  /** Admin console only; callers must have passed requireAdmin() first. */
  aggregate(limit?: number): Promise<FeedbackAggregate[]>;
}

type FeedbackRow = Database['public']['Tables']['report_feedback']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: FeedbackRow): ReportFeedbackRecord {
  return {
    userId: row.user_id,
    jobId: row.job_id,
    useful: row.useful,
    category: (FEEDBACK_CATEGORIES as readonly string[]).includes(row.category ?? '')
      ? (row.category as FeedbackCategory)
      : null,
    comment: row.comment,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

function foldAggregates(
  rows: Pick<FeedbackRow, 'job_id' | 'useful' | 'category'>[],
  limit: number,
): FeedbackAggregate[] {
  const byJob = new Map<string, FeedbackAggregate>();
  for (const row of rows) {
    let entry = byJob.get(row.job_id);
    if (!entry) {
      entry = { jobId: row.job_id, usefulCount: 0, notUsefulCount: 0, categories: {} };
      byJob.set(row.job_id, entry);
    }
    if (row.useful) entry.usefulCount += 1;
    else entry.notUsefulCount += 1;
    if (row.category) {
      const key = row.category as FeedbackCategory;
      entry.categories[key] = (entry.categories[key] ?? 0) + 1;
    }
  }
  return [...byJob.values()].slice(0, limit);
}

export class SupabaseReportFeedbackStore implements ReportFeedbackStore {
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
    input: { useful: boolean; category: FeedbackCategory | null; comment: string | null },
  ): Promise<ReportFeedbackRecord> {
    const { data, error } = await this.client
      .from('report_feedback')
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
          useful: input.useful,
          category: input.category,
          comment: input.comment,
        },
        { onConflict: 'user_id,job_id' },
      )
      .select('*')
      .single<FeedbackRow>();

    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save your feedback', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async getForUser(userId: string, jobId: string): Promise<ReportFeedbackRecord | null> {
    const { data, error } = await this.client
      .from('report_feedback')
      .select('*')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .maybeSingle<FeedbackRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read your feedback', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async aggregate(limit = 50): Promise<FeedbackAggregate[]> {
    const { data, error } = await this.client
      .from('report_feedback')
      .select('job_id, useful, category')
      .order('updated_at', { ascending: false })
      .limit(1000);

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not aggregate feedback', {
        cause: error,
      });
    }
    return foldAggregates(data ?? [], limit);
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  feedback: Map<string, ReportFeedbackRecord>;
}

const MEMORY_KEY = Symbol.for('corridor.feedback-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { feedback: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryFeedbackStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryReportFeedbackStore implements ReportFeedbackStore {
  readonly name = 'memory';

  async upsert(
    userId: string,
    jobId: string,
    input: { useful: boolean; category: FeedbackCategory | null; comment: string | null },
  ): Promise<ReportFeedbackRecord> {
    const key = `${userId}:${jobId}`;
    const existing = memory().feedback.get(key);
    const now = new Date().toISOString();
    const record: ReportFeedbackRecord = {
      userId,
      jobId,
      useful: input.useful,
      category: input.category,
      comment: input.comment,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    memory().feedback.set(key, record);
    return record;
  }

  async getForUser(userId: string, jobId: string): Promise<ReportFeedbackRecord | null> {
    return memory().feedback.get(`${userId}:${jobId}`) ?? null;
  }

  async aggregate(limit = 50): Promise<FeedbackAggregate[]> {
    return foldAggregates(
      [...memory().feedback.values()].map((record) => ({
        job_id: record.jobId,
        useful: record.useful,
        category: record.category,
      })),
      limit,
    );
  }
}

let cached: ReportFeedbackStore | null = null;

export async function getReportFeedbackStore(): Promise<ReportFeedbackStore> {
  if (cached) return cached;

  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseReportFeedbackStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryReportFeedbackStore();

  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetReportFeedbackStoreCache(): void {
  cached = null;
}
