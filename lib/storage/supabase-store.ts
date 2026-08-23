import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AuditRecord,
  AuditStore,
  CreateAuditInput,
  LeadInput,
  LeadStore,
} from './types';
import { auditReportSchema, type AuditReport, type AuditStatus } from '@/schemas/audit';
import { stageIndex, isStageId, type StageId } from '@/lib/pipeline/stages';
import { AuditError, isAuditErrorCode, type AuditErrorCode } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

/**
 * Supabase storage driver.
 *
 * Uses the service-role key, which bypasses RLS — correct, because every write
 * in this application is a server-side write on behalf of an anonymous visitor.
 * The RLS policies in the migration describe what a *browser* may do, which is
 * read a completed audit and nothing else.
 *
 * This module carries `import 'server-only'`, so a stray import from a client
 * component is a build failure rather than a leaked service-role key.
 */

interface AuditRow {
  public_id: string;
  requested_url: string;
  normalized_url: string;
  domain: string;
  status: string;
  stage: string;
  stage_index: number;
  error_code: string | null;
  schema_version: number | null;
  overall_score: number | null;
  overall_rating: string | null;
  facts: unknown;
  analysis: unknown;
  report_meta: unknown;
  created_at: string;
  completed_at: string | null;
}

export class SupabaseAuditStore implements AuditStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(input: CreateAuditInput): Promise<AuditRecord> {
    const { data, error } = await this.client
      .from('audits')
      .insert({
        public_id: input.publicId,
        requested_url: input.requestedUrl,
        normalized_url: input.normalizedUrl,
        url_hash: input.urlHash,
        domain: input.domain,
        ip_hash: input.ipHash,
        status: 'queued',
        stage: 'queued',
        stage_index: 0,
      })
      .select()
      .single<AuditRow>();

    if (error || !data) {
      throw new AuditError('STORAGE_ERROR', 'Could not create the audit record', {
        cause: error,
      });
    }

    return rowToRecord(data);
  }

  async setStage(publicId: string, stage: StageId): Promise<void> {
    const { error } = await this.client
      .from('audits')
      .update({ stage, stage_index: stageIndex(stage), status: 'running' })
      .eq('public_id', publicId);

    // A failed stage write must not abort an audit that is otherwise fine — it
    // costs the user a progress update, not their report.
    if (error) {
      logger.warn('storage.stage_write_failed', {
        publicId,
        stage,
        error: error.message,
      });
    }
  }

  async complete(publicId: string, report: AuditReport): Promise<void> {
    const { error } = await this.client
      .from('audits')
      .update({
        status: 'complete',
        stage: 'saving',
        stage_index: stageIndex('saving'),
        schema_version: report.schemaVersion,
        overall_score: report.overallScore,
        overall_rating: report.overallRating,
        facts: report.facts,
        analysis: report.analysis,
        report_meta: report.meta,
        completed_at: new Date().toISOString(),
      })
      .eq('public_id', publicId);

    if (error) {
      throw new AuditError('STORAGE_ERROR', 'Could not save the completed audit', {
        cause: error,
      });
    }
  }

  async fail(publicId: string, code: AuditErrorCode): Promise<void> {
    const { error } = await this.client
      .from('audits')
      .update({
        status: 'failed',
        error_code: code,
        completed_at: new Date().toISOString(),
      })
      .eq('public_id', publicId);

    if (error) {
      logger.error('storage.fail_write_failed', { publicId, code, error: error.message });
    }
  }

  async getByPublicId(publicId: string): Promise<AuditRecord | null> {
    const { data, error } = await this.client
      .from('audits')
      .select('*')
      .eq('public_id', publicId)
      .maybeSingle<AuditRow>();

    if (error) {
      throw new AuditError('STORAGE_ERROR', 'Could not read the audit', { cause: error });
    }
    return data ? rowToRecord(data) : null;
  }

  async findFreshByUrlHash(
    urlHash: string,
    maxAgeMs: number,
  ): Promise<AuditRecord | null> {
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();

    const { data, error } = await this.client
      .from('audits')
      .select('*')
      .eq('url_hash', urlHash)
      .eq('status', 'complete')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle<AuditRow>();

    if (error) {
      // A cache miss is always safe to assume; failing the audit would not be.
      logger.warn('storage.cache_lookup_failed', { error: error.message });
      return null;
    }
    return data ? rowToRecord(data) : null;
  }
}

export class SupabaseLeadStore implements LeadStore {
  private readonly client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(input: LeadInput): Promise<void> {
    // The lead references the audit by its internal id, so look it up first.
    let auditId: string | null = null;
    if (input.auditPublicId) {
      const { data } = await this.client
        .from('audits')
        .select('id')
        .eq('public_id', input.auditPublicId)
        .maybeSingle<{ id: string }>();
      auditId = data?.id ?? null;
    }

    const { error } = await this.client.from('leads').insert({
      audit_id: auditId,
      name: input.name,
      email: input.email,
      company: input.company,
      website: input.website,
      message: input.message,
    });

    if (error) {
      throw new AuditError('STORAGE_ERROR', 'Could not save the enquiry', {
        cause: error,
      });
    }
  }
}

/**
 * Converts a row to a record, re-validating the stored report.
 *
 * Stored JSON is re-parsed rather than cast: a row written by an older schema
 * version, or corrupted by hand, must not reach the renderer as though it were
 * the current shape. A report that fails to parse is treated as absent, which
 * surfaces as a clean error rather than a crash halfway down the page.
 */
function rowToRecord(row: AuditRow): AuditRecord {
  let report: AuditReport | null = null;

  if (row.status === 'complete' && row.facts && row.analysis) {
    const candidate = {
      schemaVersion: row.schema_version,
      publicId: row.public_id,
      url: row.normalized_url,
      domain: row.domain,
      createdAt: row.created_at,
      overallScore: row.overall_score,
      overallRating: row.overall_rating,
      facts: row.facts,
      analysis: row.analysis,
      meta: row.report_meta,
    };

    const parsed = auditReportSchema.safeParse(candidate);
    if (parsed.success) {
      report = parsed.data;
    } else {
      logger.error('storage.stored_report_invalid', {
        publicId: row.public_id,
        issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join('.')),
      });
    }
  }

  return {
    publicId: row.public_id,
    requestedUrl: row.requested_url,
    normalizedUrl: row.normalized_url,
    domain: row.domain,
    status: (['queued', 'running', 'complete', 'failed'] as const).includes(
      row.status as AuditStatus,
    )
      ? (row.status as AuditStatus)
      : 'failed',
    stage: isStageId(row.stage) ? row.stage : 'queued',
    stageIndex: row.stage_index,
    errorCode: isAuditErrorCode(row.error_code) ? row.error_code : null,
    report,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}
