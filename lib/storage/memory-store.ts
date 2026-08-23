import type {
  AuditRecord,
  AuditStore,
  CreateAuditInput,
  LeadInput,
  LeadStore,
} from './types';
import type { AuditReport } from '@/schemas/audit';
import type { StageId } from '@/lib/pipeline/stages';
import { stageIndex } from '@/lib/pipeline/stages';
import type { ErrorCode } from '@/lib/errors';

/**
 * In-memory storage driver.
 *
 * Exists so the whole application runs end to end with no external accounts —
 * which is what lets the e2e suite exercise the real routes instead of stubbing
 * them, and lets a developer clone the repo and see it work.
 *
 * It is clearly labelled rather than pretending to be a database. Serverless
 * instances do not share memory, so in production a polling request would
 * frequently land on a different instance than the one running the audit: this
 * driver is not merely non-persistent there, it is actively wrong. getAuditStore()
 * logs an error if it is ever selected outside development.
 *
 * The backing maps live on globalThis rather than in module scope. Next bundles
 * route handlers and page components separately, so plain module-level state
 * gives each bundle its own copy — an audit written by the API route was
 * genuinely invisible to the page that renders it, which is a confusing way to
 * discover a limitation. Pinning to globalThis makes the driver behave correctly
 * within a single process. It cannot, and does not pretend to, make it correct
 * across instances.
 */
interface MemoryStoreState {
  records: Map<string, AuditRecord>;
  byUrlHash: Map<string, string[]>;
  leads: LeadInput[];
}

const STATE_KEY = Symbol.for('aiseo.memory-store');

function state(): MemoryStoreState {
  const holder = globalThis as unknown as Record<symbol, MemoryStoreState | undefined>;
  if (!holder[STATE_KEY]) {
    holder[STATE_KEY] = {
      records: new Map(),
      byUrlHash: new Map(),
      leads: [],
    };
  }
  return holder[STATE_KEY];
}

export class MemoryAuditStore implements AuditStore {
  readonly name = 'memory';
  private get records() {
    return state().records;
  }
  private get byUrlHash() {
    return state().byUrlHash;
  }

  async create(input: CreateAuditInput): Promise<AuditRecord> {
    const record: AuditRecord = {
      publicId: input.publicId,
      requestedUrl: input.requestedUrl,
      normalizedUrl: input.normalizedUrl,
      domain: input.domain,
      status: 'queued',
      stage: 'queued',
      stageIndex: 0,
      errorCode: null,
      report: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    this.records.set(input.publicId, record);
    this.byUrlHash.set(input.urlHash, [
      ...(this.byUrlHash.get(input.urlHash) ?? []),
      input.publicId,
    ]);
    return record;
  }

  async setStage(publicId: string, stage: StageId): Promise<void> {
    const record = this.records.get(publicId);
    if (!record) return;
    record.stage = stage;
    record.stageIndex = stageIndex(stage);
    record.status = 'running';
  }

  async complete(publicId: string, report: AuditReport): Promise<void> {
    const record = this.records.get(publicId);
    if (!record) return;
    record.status = 'complete';
    record.report = report;
    record.completedAt = new Date().toISOString();
  }

  async fail(publicId: string, code: ErrorCode): Promise<void> {
    const record = this.records.get(publicId);
    if (!record) return;
    record.status = 'failed';
    record.errorCode = code;
    record.completedAt = new Date().toISOString();
  }

  async getByPublicId(publicId: string): Promise<AuditRecord | null> {
    const record = this.records.get(publicId);
    return record ? structuredClone(record) : null;
  }

  async findFreshByUrlHash(
    urlHash: string,
    maxAgeMs: number,
  ): Promise<AuditRecord | null> {
    const ids = this.byUrlHash.get(urlHash) ?? [];
    const cutoff = Date.now() - maxAgeMs;

    for (const id of [...ids].reverse()) {
      const record = this.records.get(id);
      if (!record || record.status !== 'complete') continue;
      if (new Date(record.createdAt).getTime() >= cutoff) return structuredClone(record);
    }
    return null;
  }

  /** Test helper. */
  clear(): void {
    this.records.clear();
    this.byUrlHash.clear();
  }
}

export class MemoryLeadStore implements LeadStore {
  get leads(): LeadInput[] {
    return state().leads;
  }
  async create(input: LeadInput): Promise<void> {
    state().leads.push(input);
  }
}
