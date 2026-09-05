import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { EvidenceRef } from '@/lib/outreach/generate';
import type { OutreachChannel } from '@/schemas/outreach';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Draft persistence with version history, plus the suppression list.
 *
 * Every body change writes a version row; approval and copying are
 * recorded acts. Nothing in this store can send anything — there is no
 * recipient and no delivery state to set.
 */

export interface DraftRecord {
  id: string;
  accountId: string;
  contactId: string | null;
  createdBy: string | null;
  channel: OutreachChannel;
  language: 'en' | 'ar';
  body: string;
  evidenceRefs: EvidenceRef[];
  status: 'draft' | 'approved' | 'rejected';
  approvedBy: string | null;
  approvedAt: string | null;
  lastCopiedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DraftVersionRecord {
  version: number;
  body: string;
  editedBy: string | null;
  createdAt: string;
}

export interface SuppressionRecord {
  id: string;
  kind: 'account' | 'contact' | 'channel_value';
  value: string;
  reason: string;
  createdBy: string | null;
  createdAt: string;
}

export interface OutreachStore {
  readonly name: string;
  createDraft(input: {
    accountId: string;
    contactId: string | null;
    createdBy: string;
    channel: OutreachChannel;
    language: 'en' | 'ar';
    body: string;
    evidenceRefs: EvidenceRef[];
  }): Promise<DraftRecord>;
  get(id: string): Promise<DraftRecord | null>;
  listForAccount(accountId: string): Promise<DraftRecord[]>;
  listByStatus(status: DraftRecord['status'], limit?: number): Promise<DraftRecord[]>;
  updateBody(id: string, body: string, editedBy: string): Promise<DraftRecord | null>;
  setStatus(
    id: string,
    status: 'approved' | 'rejected' | 'draft',
    by: string,
  ): Promise<DraftRecord | null>;
  recordCopy(id: string): Promise<void>;
  versions(id: string): Promise<DraftVersionRecord[]>;

  addSuppression(
    entry: Omit<SuppressionRecord, 'id' | 'createdAt'>,
  ): Promise<SuppressionRecord>;
  removeSuppression(id: string): Promise<boolean>;
  listSuppression(): Promise<SuppressionRecord[]>;
  isSuppressed(kind: SuppressionRecord['kind'], value: string): Promise<boolean>;
}

type DraftRow = Database['public']['Tables']['outreach_drafts']['Row'];
type VersionRow = Database['public']['Tables']['outreach_draft_versions']['Row'];
type SuppressionRow = Database['public']['Tables']['suppression_entries']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function draftRowToRecord(row: DraftRow): DraftRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    contactId: row.contact_id,
    createdBy: row.created_by,
    channel: row.channel as OutreachChannel,
    language: row.language as DraftRecord['language'],
    body: row.body,
    evidenceRefs: (row.evidence_refs ?? []) as unknown as EvidenceRef[],
    status: row.status as DraftRecord['status'],
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? toIsoUtc(row.approved_at) : null,
    lastCopiedAt: row.last_copied_at ? toIsoUtc(row.last_copied_at) : null,
    version: row.version,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

export class SupabaseOutreachStore implements OutreachStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createDraft(input: {
    accountId: string;
    contactId: string | null;
    createdBy: string;
    channel: OutreachChannel;
    language: 'en' | 'ar';
    body: string;
    evidenceRefs: EvidenceRef[];
  }): Promise<DraftRecord> {
    const { data, error } = await this.client
      .from('outreach_drafts')
      .insert({
        account_id: input.accountId,
        contact_id: input.contactId,
        created_by: input.createdBy,
        channel: input.channel,
        language: input.language,
        body: input.body,
        evidence_refs: input.evidenceRefs as never,
      })
      .select('*')
      .single<DraftRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the draft', {
        cause: error,
      });
    }
    await this.client.from('outreach_draft_versions').insert({
      draft_id: data.id,
      version: 1,
      body: input.body,
      edited_by: input.createdBy,
    });
    return draftRowToRecord(data);
  }

  async get(id: string): Promise<DraftRecord | null> {
    const { data, error } = await this.client
      .from('outreach_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle<DraftRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the draft', {
        cause: error,
      });
    }
    return data ? draftRowToRecord(data) : null;
  }

  async listForAccount(accountId: string): Promise<DraftRecord[]> {
    const { data, error } = await this.client
      .from('outreach_drafts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list drafts', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => draftRowToRecord(row as DraftRow));
  }

  async listByStatus(status: DraftRecord['status'], limit = 100): Promise<DraftRecord[]> {
    const { data, error } = await this.client
      .from('outreach_drafts')
      .select('*')
      .eq('status', status)
      .order('updated_at', { ascending: false })
      .limit(Math.min(limit, 200));
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list drafts', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => draftRowToRecord(row as DraftRow));
  }

  async updateBody(
    id: string,
    body: string,
    editedBy: string,
  ): Promise<DraftRecord | null> {
    const existing = await this.get(id);
    if (!existing) return null;
    const nextVersion = existing.version + 1;
    const { data, error } = await this.client
      .from('outreach_drafts')
      .update({
        body,
        version: nextVersion,
        status: 'draft',
        approved_by: null,
        approved_at: null,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle<DraftRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the edit', {
        cause: error,
      });
    }
    await this.client.from('outreach_draft_versions').insert({
      draft_id: id,
      version: nextVersion,
      body,
      edited_by: editedBy,
    });
    return draftRowToRecord(data);
  }

  async setStatus(
    id: string,
    status: 'approved' | 'rejected' | 'draft',
    by: string,
  ): Promise<DraftRecord | null> {
    const { data, error } = await this.client
      .from('outreach_drafts')
      .update(
        status === 'approved'
          ? { status, approved_by: by, approved_at: new Date().toISOString() }
          : { status, approved_by: null, approved_at: null },
      )
      .eq('id', id)
      .select('*')
      .maybeSingle<DraftRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the draft', {
        cause: error,
      });
    }
    return data ? draftRowToRecord(data) : null;
  }

  async recordCopy(id: string): Promise<void> {
    await this.client
      .from('outreach_drafts')
      .update({ last_copied_at: new Date().toISOString() })
      .eq('id', id);
  }

  async versions(id: string): Promise<DraftVersionRecord[]> {
    const { data, error } = await this.client
      .from('outreach_draft_versions')
      .select('*')
      .eq('draft_id', id)
      .order('version', { ascending: false })
      .limit(50);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list versions', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => {
      const version = row as VersionRow;
      return {
        version: version.version,
        body: version.body,
        editedBy: version.edited_by,
        createdAt: toIsoUtc(version.created_at),
      };
    });
  }

  async addSuppression(
    entry: Omit<SuppressionRecord, 'id' | 'createdAt'>,
  ): Promise<SuppressionRecord> {
    const { data, error } = await this.client
      .from('suppression_entries')
      .upsert(
        {
          kind: entry.kind,
          value: entry.value,
          reason: entry.reason,
          created_by: entry.createdBy,
        },
        { onConflict: 'kind,value' },
      )
      .select('*')
      .single<SuppressionRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the suppression', {
        cause: error,
      });
    }
    return {
      id: data.id,
      kind: data.kind as SuppressionRecord['kind'],
      value: data.value,
      reason: data.reason,
      createdBy: data.created_by,
      createdAt: toIsoUtc(data.created_at),
    };
  }

  async removeSuppression(id: string): Promise<boolean> {
    const { data } = await this.client
      .from('suppression_entries')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle<{ id: string }>();
    return Boolean(data);
  }

  async listSuppression(): Promise<SuppressionRecord[]> {
    const { data, error } = await this.client
      .from('suppression_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list suppressions', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => {
      const entry = row as SuppressionRow;
      return {
        id: entry.id,
        kind: entry.kind as SuppressionRecord['kind'],
        value: entry.value,
        reason: entry.reason,
        createdBy: entry.created_by,
        createdAt: toIsoUtc(entry.created_at),
      };
    });
  }

  async isSuppressed(kind: SuppressionRecord['kind'], value: string): Promise<boolean> {
    const { data } = await this.client
      .from('suppression_entries')
      .select('id')
      .eq('kind', kind)
      .eq('value', value)
      .maybeSingle<{ id: string }>();
    return Boolean(data);
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  drafts: Map<string, DraftRecord>;
  versions: Map<string, DraftVersionRecord[]>;
  suppression: Map<string, SuppressionRecord>;
}

const MEMORY_KEY = Symbol.for('alt.outreach-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) {
    holder[MEMORY_KEY] = {
      drafts: new Map(),
      versions: new Map(),
      suppression: new Map(),
    };
  }
  return holder[MEMORY_KEY]!;
}

export function resetMemoryOutreachStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryOutreachStore implements OutreachStore {
  readonly name = 'memory';

  async createDraft(input: {
    accountId: string;
    contactId: string | null;
    createdBy: string;
    channel: OutreachChannel;
    language: 'en' | 'ar';
    body: string;
    evidenceRefs: EvidenceRef[];
  }): Promise<DraftRecord> {
    const now = new Date().toISOString();
    const record: DraftRecord = {
      id: crypto.randomUUID(),
      accountId: input.accountId,
      contactId: input.contactId,
      createdBy: input.createdBy,
      channel: input.channel,
      language: input.language,
      body: input.body,
      evidenceRefs: input.evidenceRefs,
      status: 'draft',
      approvedBy: null,
      approvedAt: null,
      lastCopiedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    memory().drafts.set(record.id, record);
    memory().versions.set(record.id, [
      { version: 1, body: input.body, editedBy: input.createdBy, createdAt: now },
    ]);
    return record;
  }

  async get(id: string): Promise<DraftRecord | null> {
    return memory().drafts.get(id) ?? null;
  }

  async listForAccount(accountId: string): Promise<DraftRecord[]> {
    return [...memory().drafts.values()]
      .filter((draft) => draft.accountId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listByStatus(status: DraftRecord['status'], limit = 100): Promise<DraftRecord[]> {
    return [...memory().drafts.values()]
      .filter((draft) => draft.status === status)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.min(limit, 200));
  }

  async updateBody(
    id: string,
    body: string,
    editedBy: string,
  ): Promise<DraftRecord | null> {
    const draft = memory().drafts.get(id);
    if (!draft) return null;
    draft.body = body;
    draft.version += 1;
    draft.status = 'draft';
    draft.approvedBy = null;
    draft.approvedAt = null;
    draft.updatedAt = new Date().toISOString();
    memory().versions.get(id)!.unshift({
      version: draft.version,
      body,
      editedBy,
      createdAt: draft.updatedAt,
    });
    return draft;
  }

  async setStatus(
    id: string,
    status: 'approved' | 'rejected' | 'draft',
    by: string,
  ): Promise<DraftRecord | null> {
    const draft = memory().drafts.get(id);
    if (!draft) return null;
    draft.status = status;
    draft.approvedBy = status === 'approved' ? by : null;
    draft.approvedAt = status === 'approved' ? new Date().toISOString() : null;
    draft.updatedAt = new Date().toISOString();
    return draft;
  }

  async recordCopy(id: string): Promise<void> {
    const draft = memory().drafts.get(id);
    if (draft) draft.lastCopiedAt = new Date().toISOString();
  }

  async versions(id: string): Promise<DraftVersionRecord[]> {
    return [...(memory().versions.get(id) ?? [])];
  }

  async addSuppression(
    entry: Omit<SuppressionRecord, 'id' | 'createdAt'>,
  ): Promise<SuppressionRecord> {
    const key = `${entry.kind}:${entry.value}`;
    const existing = [...memory().suppression.values()].find(
      (candidate) => `${candidate.kind}:${candidate.value}` === key,
    );
    if (existing) return existing;
    const record: SuppressionRecord = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    memory().suppression.set(record.id, record);
    return record;
  }

  async removeSuppression(id: string): Promise<boolean> {
    return memory().suppression.delete(id);
  }

  async listSuppression(): Promise<SuppressionRecord[]> {
    return [...memory().suppression.values()].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async isSuppressed(kind: SuppressionRecord['kind'], value: string): Promise<boolean> {
    return [...memory().suppression.values()].some(
      (entry) => entry.kind === kind && entry.value === value,
    );
  }
}

let cached: OutreachStore | null = null;

export async function getOutreachStore(): Promise<OutreachStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseOutreachStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryOutreachStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetOutreachStoreCache(): void {
  cached = null;
}
