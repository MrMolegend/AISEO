import type { AuditStatus, AuditReport } from '@/schemas/audit';
import type { StageId } from '@/lib/pipeline/stages';
import type { ErrorCode } from '@/lib/errors';

/**
 * The storage contract.
 *
 * Two drivers implement it: Supabase for anything real, and an in-memory driver
 * so the application runs end to end with no external accounts. The interface is
 * deliberately narrow — the pipeline needs to create a row, advance a stage,
 * finish or fail, and read one back. Nothing more.
 */

export interface AuditRecord {
  publicId: string;
  requestedUrl: string;
  normalizedUrl: string;
  domain: string;
  status: AuditStatus;
  stage: StageId;
  stageIndex: number;
  errorCode: ErrorCode | null;
  report: AuditReport | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateAuditInput {
  publicId: string;
  requestedUrl: string;
  normalizedUrl: string;
  urlHash: string;
  domain: string;
  ipHash: string | null;
}

export interface AuditStore {
  readonly name: string;
  create(input: CreateAuditInput): Promise<AuditRecord>;
  setStage(publicId: string, stage: StageId): Promise<void>;
  complete(publicId: string, report: AuditReport): Promise<void>;
  fail(publicId: string, code: ErrorCode): Promise<void>;
  getByPublicId(publicId: string): Promise<AuditRecord | null>;
  /** Most recent completed audit for a URL within the freshness window. */
  findFreshByUrlHash(urlHash: string, maxAgeMs: number): Promise<AuditRecord | null>;
}

export interface LeadInput {
  auditPublicId: string | null;
  name: string;
  email: string;
  company: string | null;
  website: string | null;
  message: string | null;
}

export interface LeadStore {
  create(input: LeadInput): Promise<void>;
}
