import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import type { Database, Json } from '@/supabase/database.types';
import type { ResearchPackageId } from '@/config/packages';
import type { MarketEntryPackageId } from '@/config/report';
import type { ResearchInput } from '@/schemas/research/inputs';
import type { MarketEntryInput } from '@/schemas/market-entry/input';
import type { StoredSource, ReportMeta } from '@/schemas/research/shared';
import { PlatformError, isErrorCode, type ErrorCode } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';
import { logger } from '@/lib/observability/logger';
import {
  isStageId,
  isJobStatus,
  stageIndex,
  type JobStatus,
  type StageId,
  type StoredStageId,
} from './stages';

/**
 * Research job storage.
 *
 * Two drivers behind one interface, as elsewhere. The Supabase one is
 * authoritative; the memory one keeps the application usable without
 * credentials and keeps tests off the network.
 *
 * The access rules are enforced here rather than left to callers:
 *
 *   · A private read requires the owner's id, and the query filters on it. Not
 *     "fetch then compare" — the row never leaves the database unless it
 *     belongs to the caller, so a forgotten comparison cannot leak it.
 *   · A public read matches on public_id alone, which is a 16-character
 *     capability. That is the sharing mechanism, and it is why public_id is
 *     high-entropy and the uuid primary key never leaves the server.
 */

/** ~95 bits. The only identifier that reaches a browser or a shared link. */
const PUBLIC_ID_LENGTH = 16;

/**
 * Every package id that may appear in a stored row.
 *
 * Only `market-entry` can be created now. The four legacy ids remain in the
 * type because rows carrying them are still in the database and still readable
 * at their original URLs — narrowing this to the current product would make
 * reading one of those rows a type error, which is the same mistake as
 * narrowing the stage union.
 */
export type StoredPackageId = ResearchPackageId | MarketEntryPackageId;
export type StoredInput = ResearchInput | MarketEntryInput;

export interface ResearchJobRecord {
  id: string;
  publicId: string;
  userId: string;
  packageId: StoredPackageId;
  tokenCost: number;
  input: StoredInput;
  inputHash: string;
  subjectName: string;
  subjectDomain: string | null;
  status: JobStatus;
  stage: StoredStageId;
  stageIndex: number;
  errorCode: ErrorCode | null;
  report: unknown;
  sources: StoredSource[];
  meta: ReportMeta | null;
  cachedFromJobId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateJobInput {
  userId: string;
  packageId: StoredPackageId;
  tokenCost: number;
  input: StoredInput;
  inputHash: string;
  subjectName: string;
  subjectDomain: string | null;
  cachedFromJobId?: string | null;
}

export interface CompleteJobInput {
  jobId: string;
  report: unknown;
  sources: StoredSource[];
  meta: ReportMeta;
  /**
   * Which report shape `report` is.
   *
   * Stored rather than inferred, so a renderer can dispatch on a number instead
   * of sniffing for the presence of a key. Version 1 is the previous product's
   * four-package output; version 2 is the market-entry dossier.
   */
  schemaVersion: number;
}

export interface ResearchJobStore {
  readonly name: string;
  create(input: CreateJobInput): Promise<ResearchJobRecord>;
  setStage(jobId: string, stage: StageId): Promise<void>;
  complete(input: CompleteJobInput): Promise<void>;
  fail(jobId: string, code: ErrorCode): Promise<void>;
  /** Owner-scoped read. Returns null for anyone else's job. */
  getForUser(publicId: string, userId: string): Promise<ResearchJobRecord | null>;
  /** Capability read, by public id alone. Only ever returns a complete job. */
  getPublic(publicId: string): Promise<ResearchJobRecord | null>;
  listForUser(userId: string, limit?: number): Promise<ResearchJobRecord[]>;
  /** A recent completed job of this user's with identical inputs. */
  findCached(
    userId: string,
    inputHash: string,
    maxAgeMs: number,
  ): Promise<ResearchJobRecord | null>;
}

export function newPublicId(): string {
  return nanoid(PUBLIC_ID_LENGTH);
}

/**
 * Normalises a Postgres timestamptz to canonical UTC.
 *
 * Postgres returns `2026-08-23T21:04:33.572839+00:00`; the rest of the
 * application assumes a trailing Z. This is the same class of bug that made
 * completed reports unreadable in the previous product, so the conversion
 * happens once, at the driver, rather than being assumed anywhere else.
 * Unparseable values pass through untouched so a corrupt row stays a rejected
 * row rather than a crash.
 */
function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

type JobRow = Database['public']['Tables']['research_jobs']['Row'];

/** Narrows a validated domain object to the database's Json type. */
function toJson(value: unknown): Json {
  return value as Json;
}

function rowToRecord(row: JobRow, sources: StoredSource[]): ResearchJobRecord {
  const result = (row.result ?? null) as {
    report?: unknown;
    meta?: ReportMeta;
  } | null;

  return {
    id: row.id,
    publicId: row.public_id,
    userId: row.user_id,
    packageId: row.package_id as ResearchPackageId,
    tokenCost: row.token_cost,
    input: row.input as unknown as ResearchInput,
    inputHash: row.input_hash,
    subjectName: row.subject_name,
    subjectDomain: row.subject_domain,
    status: isJobStatus(row.status) ? row.status : 'failed',
    stage: isStageId(row.stage) ? row.stage : 'context',
    stageIndex: row.stage_index,
    errorCode: isErrorCode(row.error_code) ? row.error_code : null,
    report: result?.report ?? null,
    sources,
    meta: result?.meta ?? null,
    cachedFromJobId: row.cached_from_job_id,
    createdAt: toIsoUtc(row.created_at),
    startedAt: row.started_at ? toIsoUtc(row.started_at) : null,
    completedAt: row.completed_at ? toIsoUtc(row.completed_at) : null,
  };
}

export class SupabaseResearchJobStore implements ResearchJobStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(input: CreateJobInput): Promise<ResearchJobRecord> {
    const publicId = newPublicId();

    const { data, error } = await this.client
      .from('research_jobs')
      .insert({
        public_id: publicId,
        user_id: input.userId,
        package_id: input.packageId,
        token_cost: input.tokenCost,
        input: toJson(input.input),
        input_hash: input.inputHash,
        subject_name: input.subjectName,
        subject_domain: input.subjectDomain,
        status: 'queued',
        stage: 'context',
        stage_index: 0,
        cached_from_job_id: input.cachedFromJobId ?? null,
      })
      .select('*')
      .single<JobRow>();

    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the research job', {
        cause: error,
      });
    }
    return rowToRecord(data, []);
  }

  async setStage(jobId: string, stage: StageId): Promise<void> {
    const { statusForStage } = await import('./stages');

    const { error } = await this.client
      .from('research_jobs')
      .update({
        stage,
        stage_index: stageIndex(stage),
        status: statusForStage(stage),
        ...(stage === 'mapping' ? { started_at: new Date().toISOString() } : {}),
      })
      .eq('id', jobId)
      /*
       * Terminal jobs are immutable to progress writes.
       *
       * Every stage maps to a non-terminal status, so a stage write landing
       * after completion moves a finished job back to "still working" — the
       * status endpoint then never reports done and the browser polls a report
       * that already exists. The runner is ordered so this cannot happen; this
       * filter is what makes it not happen again, including for a late write
       * from a run that was abandoned.
       */
      .not('status', 'in', '(complete,failed,cancelled)');

    // A lost progress update costs the user a status line, not their report.
    if (error) {
      logger.warn('jobs.stage_write_failed', { jobId, stage, error: error.message });
    }
  }

  async complete(input: CompleteJobInput): Promise<void> {
    const { error } = await this.client
      .from('research_jobs')
      .update({
        status: 'complete',
        stage: 'dossier',
        stage_index: stageIndex('dossier'),
        result: toJson({ report: input.report, meta: input.meta }),
        schema_version: input.schemaVersion,
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.jobId);

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the completed report', {
        cause: error,
      });
    }

    if (input.sources.length > 0) {
      const { error: sourceError } = await this.client.from('research_sources').insert(
        input.sources.map((source) => ({
          job_id: input.jobId,
          position: source.position,
          canonical_url: source.url,
          title: source.title,
          source_type: 'web_page',
          publisher_domain: source.publisherDomain,
          retrieved_at: source.retrievedAt,
        })),
      );

      // Sources are also embedded in the stored report, so this table is a
      // queryable index rather than the only copy. Losing it costs analytics,
      // not citations.
      if (sourceError) {
        logger.warn('jobs.source_write_failed', {
          jobId: input.jobId,
          error: sourceError.message,
        });
      }
    }
  }

  async fail(jobId: string, code: ErrorCode): Promise<void> {
    const { error } = await this.client
      .from('research_jobs')
      .update({
        status: 'failed',
        error_code: code,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      logger.error('jobs.fail_write_failed', { jobId, code, error: error.message });
    }
  }

  async getForUser(publicId: string, userId: string): Promise<ResearchJobRecord | null> {
    // The user filter is part of the query, not a check afterwards: a row that
    // is not yours never leaves the database, so there is no comparison to
    // forget.
    const { data, error } = await this.client
      .from('research_jobs')
      .select('*')
      .eq('public_id', publicId)
      .eq('user_id', userId)
      .maybeSingle<JobRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the research job', {
        cause: error,
      });
    }
    return data ? rowToRecord(data, []) : null;
  }

  async getPublic(publicId: string): Promise<ResearchJobRecord | null> {
    const { data, error } = await this.client
      .from('research_jobs')
      .select('*')
      .eq('public_id', publicId)
      .eq('status', 'complete')
      .maybeSingle<JobRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the report', {
        cause: error,
      });
    }
    return data ? rowToRecord(data, []) : null;
  }

  async listForUser(userId: string, limit = 25): Promise<ResearchJobRecord[]> {
    const { data, error } = await this.client
      .from('research_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list your research', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as JobRow, []));
  }

  async findCached(
    userId: string,
    inputHash: string,
    maxAgeMs: number,
  ): Promise<ResearchJobRecord | null> {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

    const { data, error } = await this.client
      .from('research_jobs')
      .select('*')
      .eq('user_id', userId)
      .eq('input_hash', inputHash)
      .eq('status', 'complete')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<JobRow>();

    if (error) {
      // A cache miss is always safe to assume; failing the request is not.
      logger.warn('jobs.cache_lookup_failed', { error: error.message });
      return null;
    }
    return data ? rowToRecord(data, []) : null;
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  jobs: Map<string, ResearchJobRecord>;
}

const MEMORY_KEY = Symbol.for('corridor.job-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { jobs: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryJobStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryResearchJobStore implements ResearchJobStore {
  readonly name = 'memory';

  async create(input: CreateJobInput): Promise<ResearchJobRecord> {
    const record: ResearchJobRecord = {
      id: crypto.randomUUID(),
      publicId: newPublicId(),
      userId: input.userId,
      packageId: input.packageId,
      tokenCost: input.tokenCost,
      input: input.input,
      inputHash: input.inputHash,
      subjectName: input.subjectName,
      subjectDomain: input.subjectDomain,
      status: 'queued',
      stage: 'context',
      stageIndex: 0,
      errorCode: null,
      report: null,
      sources: [],
      meta: null,
      cachedFromJobId: input.cachedFromJobId ?? null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
    };
    memory().jobs.set(record.id, record);
    return record;
  }

  private byId(jobId: string): ResearchJobRecord | undefined {
    return memory().jobs.get(jobId);
  }

  async setStage(jobId: string, stage: StageId): Promise<void> {
    const { statusForStage, isTerminal } = await import('./stages');
    const job = this.byId(jobId);
    if (!job) return;
    // See the note on the Supabase driver: a terminal job takes no more
    // progress writes, or a finished report reverts to "still working".
    if (isTerminal(job.status)) return;
    job.stage = stage;
    job.stageIndex = stageIndex(stage);
    job.status = statusForStage(stage);
    if (stage === 'mapping' && !job.startedAt) {
      job.startedAt = new Date().toISOString();
    }
  }

  async complete(input: CompleteJobInput): Promise<void> {
    const job = this.byId(input.jobId);
    if (!job) throw new PlatformError('STORAGE_ERROR', 'Job vanished before completion');
    job.status = 'complete';
    job.stage = 'dossier';
    job.stageIndex = stageIndex('dossier');
    job.report = input.report;
    job.sources = input.sources;
    job.meta = input.meta;
    job.completedAt = new Date().toISOString();
  }

  async fail(jobId: string, code: ErrorCode): Promise<void> {
    const job = this.byId(jobId);
    if (!job) return;
    job.status = 'failed';
    job.errorCode = code;
    job.completedAt = new Date().toISOString();
  }

  async getForUser(publicId: string, userId: string): Promise<ResearchJobRecord | null> {
    for (const job of memory().jobs.values()) {
      if (job.publicId === publicId && job.userId === userId) return job;
    }
    return null;
  }

  async getPublic(publicId: string): Promise<ResearchJobRecord | null> {
    for (const job of memory().jobs.values()) {
      if (job.publicId === publicId && job.status === 'complete') return job;
    }
    return null;
  }

  async listForUser(userId: string, limit = 25): Promise<ResearchJobRecord[]> {
    return [...memory().jobs.values()]
      .filter((job) => job.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async findCached(
    userId: string,
    inputHash: string,
    maxAgeMs: number,
  ): Promise<ResearchJobRecord | null> {
    const cutoff = Date.now() - maxAgeMs;
    return (
      [...memory().jobs.values()]
        .filter(
          (job) =>
            job.userId === userId &&
            job.inputHash === inputHash &&
            job.status === 'complete' &&
            new Date(job.createdAt).getTime() >= cutoff,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    );
  }
}

let cached: ResearchJobStore | null = null;

export async function getResearchJobStore(): Promise<ResearchJobStore> {
  if (cached) return cached;

  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseResearchJobStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryResearchJobStore();

  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetResearchJobStoreCache(): void {
  cached = null;
}
