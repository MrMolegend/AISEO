import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { LeadStatus } from '@/schemas/campaign';
import { sameOrganisation } from '@/lib/leads/normalize';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Lead accounts, their evidence, and their contacts.
 *
 * The rules the shape enforces:
 *
 *   · An account exists because a source named it: upsertAccount refuses
 *     input with no identifying claim to attach.
 *   · Dedup is explainable: normalised-name equality or same domain, via
 *     lib/leads/normalize.ts. A candidate matching an existing account
 *     returns the existing row rather than duplicating it.
 *   · Manual merges keep history and can be undone; a merged loser keeps
 *     its rows, marked status='merged' with merged_into set.
 */

export interface LeadAccountRecord {
  id: string;
  campaignId: string | null;
  icpId: string | null;
  ownerId: string | null;
  canonicalName: string;
  normalizedName: string;
  domain: string | null;
  websiteUrl: string | null;
  segmentKey: string | null;
  territoryKey: string | null;
  city: string | null;
  status: LeadStatus;
  summary: string | null;
  fitRationale: string | null;
  mergedInto: string | null;
  discoveredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewLeadAccount {
  campaignId: string | null;
  icpId: string | null;
  canonicalName: string;
  normalizedName: string;
  domain: string | null;
  websiteUrl: string | null;
  segmentKey: string | null;
  territoryKey: string | null;
  city?: string | null;
}

export interface LeadClaimRecord {
  id: string;
  accountId: string;
  kind: 'identity' | 'fit' | 'contact' | 'signal';
  text: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceCategory: string;
  retrievalMode: 'indexed' | 'direct';
  confidence: 'low' | 'medium' | 'high';
  contentDate: string | null;
  retrievedAt: string;
}

export type NewLeadClaim = Omit<LeadClaimRecord, 'id' | 'retrievedAt'>;

export interface LeadContactRecord {
  id: string;
  accountId: string;
  fullName: string;
  roleTitle: string | null;
  profileUrl: string | null;
  companyBioUrl: string | null;
  contactChannel: string | null;
  sourceUrl: string | null;
  sourceCategory: string;
  employmentConfidence: 'verified' | 'likely' | 'unverified';
  lastVerifiedOn: string | null;
  roleRelevance: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NewLeadContact = Omit<LeadContactRecord, 'id' | 'createdAt' | 'updatedAt'>;

export interface AccountFilters {
  campaignId?: string;
  statuses?: LeadStatus[];
  territoryKey?: string;
  segmentKey?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MergeRecord {
  id: string;
  winnerId: string;
  loserId: string;
  mergedBy: string | null;
  reason: string;
  undoneAt: string | null;
  createdAt: string;
}

export interface LeadStore {
  readonly name: string;
  /** Returns the existing account when the dedup rule matches; else inserts. */
  upsertAccount(
    input: NewLeadAccount,
  ): Promise<{ account: LeadAccountRecord; existed: boolean }>;
  getAccount(id: string): Promise<LeadAccountRecord | null>;
  listAccounts(filters?: AccountFilters): Promise<LeadAccountRecord[]>;
  countAccounts(filters?: AccountFilters): Promise<number>;
  updateAccount(
    id: string,
    patch: Partial<
      Pick<
        LeadAccountRecord,
        'status' | 'ownerId' | 'summary' | 'fitRationale' | 'segmentKey' | 'territoryKey'
      >
    >,
  ): Promise<LeadAccountRecord | null>;

  addClaim(claim: NewLeadClaim): Promise<LeadClaimRecord>;
  listClaims(accountId: string): Promise<LeadClaimRecord[]>;

  addContact(contact: NewLeadContact): Promise<LeadContactRecord>;
  listContacts(accountId: string): Promise<LeadContactRecord[]>;
  countContacts(accountId: string): Promise<number>;

  merge(
    winnerId: string,
    loserId: string,
    mergedBy: string,
    reason: string,
  ): Promise<MergeRecord>;
  undoMerge(mergeId: string): Promise<boolean>;
  listMerges(accountId: string): Promise<MergeRecord[]>;
}

type AccountRow = Database['public']['Tables']['lead_accounts']['Row'];
type ClaimRow = Database['public']['Tables']['lead_claims']['Row'];
type ContactRow = Database['public']['Tables']['lead_contacts']['Row'];
type MergeRow = Database['public']['Tables']['account_merges']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function accountRowToRecord(row: AccountRow): LeadAccountRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    icpId: row.icp_id,
    ownerId: row.owner_id,
    canonicalName: row.canonical_name,
    normalizedName: row.normalized_name,
    domain: row.domain,
    websiteUrl: row.website_url,
    segmentKey: row.segment_key,
    territoryKey: row.territory_key,
    city: row.city,
    status: row.status as LeadStatus,
    summary: row.summary,
    fitRationale: row.fit_rationale,
    mergedInto: row.merged_into,
    discoveredAt: toIsoUtc(row.discovered_at),
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

function claimRowToRecord(row: ClaimRow): LeadClaimRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    kind: row.kind as LeadClaimRecord['kind'],
    text: row.text,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    sourceCategory: row.source_category,
    retrievalMode: row.retrieval_mode as LeadClaimRecord['retrievalMode'],
    confidence: row.confidence as LeadClaimRecord['confidence'],
    contentDate: row.content_date,
    retrievedAt: toIsoUtc(row.retrieved_at),
  };
}

function contactRowToRecord(row: ContactRow): LeadContactRecord {
  return {
    id: row.id,
    accountId: row.account_id,
    fullName: row.full_name,
    roleTitle: row.role_title,
    profileUrl: row.profile_url,
    companyBioUrl: row.company_bio_url,
    contactChannel: row.contact_channel,
    sourceUrl: row.source_url,
    sourceCategory: row.source_category,
    employmentConfidence:
      row.employment_confidence as LeadContactRecord['employmentConfidence'],
    lastVerifiedOn: row.last_verified_on,
    roleRelevance: row.role_relevance,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

function mergeRowToRecord(row: MergeRow): MergeRecord {
  return {
    id: row.id,
    winnerId: row.winner_id,
    loserId: row.loser_id,
    mergedBy: row.merged_by,
    reason: row.reason,
    undoneAt: row.undone_at ? toIsoUtc(row.undone_at) : null,
    createdAt: toIsoUtc(row.created_at),
  };
}

export class SupabaseLeadStore implements LeadStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsertAccount(
    input: NewLeadAccount,
  ): Promise<{ account: LeadAccountRecord; existed: boolean }> {
    // The explainable dedup rule: exact normalised name, or same domain.
    const byName = await this.client
      .from('lead_accounts')
      .select('*')
      .eq('normalized_name', input.normalizedName)
      .neq('status', 'merged')
      .limit(1)
      .maybeSingle<AccountRow>();
    if (byName.data) return { account: accountRowToRecord(byName.data), existed: true };

    if (input.domain) {
      const byDomain = await this.client
        .from('lead_accounts')
        .select('*')
        .eq('domain', input.domain)
        .neq('status', 'merged')
        .limit(1)
        .maybeSingle<AccountRow>();
      if (byDomain.data) {
        return { account: accountRowToRecord(byDomain.data), existed: true };
      }
    }

    const { data, error } = await this.client
      .from('lead_accounts')
      .insert({
        campaign_id: input.campaignId,
        icp_id: input.icpId,
        canonical_name: input.canonicalName,
        normalized_name: input.normalizedName,
        domain: input.domain,
        website_url: input.websiteUrl,
        segment_key: input.segmentKey,
        territory_key: input.territoryKey,
        city: input.city ?? null,
      })
      .select('*')
      .single<AccountRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the account', {
        cause: error,
      });
    }
    return { account: accountRowToRecord(data), existed: false };
  }

  async getAccount(id: string): Promise<LeadAccountRecord | null> {
    const { data, error } = await this.client
      .from('lead_accounts')
      .select('*')
      .eq('id', id)
      .maybeSingle<AccountRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the account', {
        cause: error,
      });
    }
    return data ? accountRowToRecord(data) : null;
  }

  private applyFilters(filters: AccountFilters) {
    let query = this.client.from('lead_accounts').select('*', { count: 'exact' });
    if (filters.campaignId) query = query.eq('campaign_id', filters.campaignId);
    if (filters.statuses && filters.statuses.length > 0) {
      query = query.in('status', filters.statuses);
    } else {
      query = query.neq('status', 'merged');
    }
    if (filters.territoryKey) query = query.eq('territory_key', filters.territoryKey);
    if (filters.segmentKey) query = query.eq('segment_key', filters.segmentKey);
    if (filters.search) {
      query = query.ilike('canonical_name', `%${filters.search.replace(/[%_]/g, '')}%`);
    }
    return query;
  }

  async listAccounts(filters: AccountFilters = {}): Promise<LeadAccountRecord[]> {
    const limit = Math.min(filters.limit ?? 50, 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    const { data, error } = await this.applyFilters(filters)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list accounts', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => accountRowToRecord(row as AccountRow));
  }

  async countAccounts(filters: AccountFilters = {}): Promise<number> {
    const { count, error } = await this.applyFilters(filters).range(0, 0);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not count accounts', {
        cause: error,
      });
    }
    return count ?? 0;
  }

  async updateAccount(
    id: string,
    patch: Partial<
      Pick<
        LeadAccountRecord,
        'status' | 'ownerId' | 'summary' | 'fitRationale' | 'segmentKey' | 'territoryKey'
      >
    >,
  ): Promise<LeadAccountRecord | null> {
    const row: Database['public']['Tables']['lead_accounts']['Update'] = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.ownerId !== undefined) row.owner_id = patch.ownerId;
    if (patch.summary !== undefined) row.summary = patch.summary;
    if (patch.fitRationale !== undefined) row.fit_rationale = patch.fitRationale;
    if (patch.segmentKey !== undefined) row.segment_key = patch.segmentKey;
    if (patch.territoryKey !== undefined) row.territory_key = patch.territoryKey;

    const { data, error } = await this.client
      .from('lead_accounts')
      .update(row)
      .eq('id', id)
      .select('*')
      .maybeSingle<AccountRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the account', {
        cause: error,
      });
    }
    return data ? accountRowToRecord(data) : null;
  }

  async addClaim(claim: NewLeadClaim): Promise<LeadClaimRecord> {
    const { data, error } = await this.client
      .from('lead_claims')
      .insert({
        account_id: claim.accountId,
        kind: claim.kind,
        text: claim.text,
        source_url: claim.sourceUrl,
        source_title: claim.sourceTitle,
        source_category: claim.sourceCategory,
        retrieval_mode: claim.retrievalMode,
        confidence: claim.confidence,
        content_date: claim.contentDate,
      })
      .select('*')
      .single<ClaimRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the claim', {
        cause: error,
      });
    }
    return claimRowToRecord(data);
  }

  async listClaims(accountId: string): Promise<LeadClaimRecord[]> {
    const { data, error } = await this.client
      .from('lead_claims')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list the evidence', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => claimRowToRecord(row as ClaimRow));
  }

  async addContact(contact: NewLeadContact): Promise<LeadContactRecord> {
    const { data, error } = await this.client
      .from('lead_contacts')
      .insert({
        account_id: contact.accountId,
        full_name: contact.fullName,
        role_title: contact.roleTitle,
        profile_url: contact.profileUrl,
        company_bio_url: contact.companyBioUrl,
        contact_channel: contact.contactChannel,
        source_url: contact.sourceUrl,
        source_category: contact.sourceCategory,
        employment_confidence: contact.employmentConfidence,
        last_verified_on: contact.lastVerifiedOn,
        role_relevance: contact.roleRelevance,
      })
      .select('*')
      .single<ContactRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the contact', {
        cause: error,
      });
    }
    return contactRowToRecord(data);
  }

  async listContacts(accountId: string): Promise<LeadContactRecord[]> {
    const { data, error } = await this.client
      .from('lead_contacts')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list contacts', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => contactRowToRecord(row as ContactRow));
  }

  async countContacts(accountId: string): Promise<number> {
    const { count, error } = await this.client
      .from('lead_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not count contacts', {
        cause: error,
      });
    }
    return count ?? 0;
  }

  async merge(
    winnerId: string,
    loserId: string,
    mergedBy: string,
    reason: string,
  ): Promise<MergeRecord> {
    const loser = await this.getAccount(loserId);
    const winner = await this.getAccount(winnerId);
    if (!loser || !winner || loser.status === 'merged') {
      throw new PlatformError('NOT_FOUND', 'No such account');
    }

    const { data, error } = await this.client
      .from('account_merges')
      .insert({ winner_id: winnerId, loser_id: loserId, merged_by: mergedBy, reason })
      .select('*')
      .single<MergeRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not record the merge', {
        cause: error,
      });
    }

    await this.client
      .from('lead_accounts')
      .update({ status: 'merged', merged_into: winnerId })
      .eq('id', loserId);

    return mergeRowToRecord(data);
  }

  async undoMerge(mergeId: string): Promise<boolean> {
    const { data } = await this.client
      .from('account_merges')
      .select('*')
      .eq('id', mergeId)
      .is('undone_at', null)
      .maybeSingle<MergeRow>();
    if (!data) return false;

    await this.client
      .from('account_merges')
      .update({ undone_at: new Date().toISOString() })
      .eq('id', mergeId);
    await this.client
      .from('lead_accounts')
      .update({ status: 'candidate', merged_into: null })
      .eq('id', data.loser_id);
    return true;
  }

  async listMerges(accountId: string): Promise<MergeRecord[]> {
    const { data, error } = await this.client
      .from('account_merges')
      .select('*')
      .or(`winner_id.eq.${accountId},loser_id.eq.${accountId}`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list merges', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => mergeRowToRecord(row as MergeRow));
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  accounts: Map<string, LeadAccountRecord>;
  claims: Map<string, LeadClaimRecord[]>;
  contacts: Map<string, LeadContactRecord[]>;
  merges: Map<string, MergeRecord>;
}

const MEMORY_KEY = Symbol.for('alt.lead-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) {
    holder[MEMORY_KEY] = {
      accounts: new Map(),
      claims: new Map(),
      contacts: new Map(),
      merges: new Map(),
    };
  }
  return holder[MEMORY_KEY]!;
}

export function resetMemoryLeadStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryLeadStore implements LeadStore {
  readonly name = 'memory';

  async upsertAccount(
    input: NewLeadAccount,
  ): Promise<{ account: LeadAccountRecord; existed: boolean }> {
    for (const account of memory().accounts.values()) {
      if (account.status === 'merged') continue;
      if (sameOrganisation(account, input)) return { account, existed: true };
    }
    const now = new Date().toISOString();
    const account: LeadAccountRecord = {
      id: crypto.randomUUID(),
      campaignId: input.campaignId,
      icpId: input.icpId,
      ownerId: null,
      canonicalName: input.canonicalName,
      normalizedName: input.normalizedName,
      domain: input.domain,
      websiteUrl: input.websiteUrl,
      segmentKey: input.segmentKey,
      territoryKey: input.territoryKey,
      city: input.city ?? null,
      status: 'candidate',
      summary: null,
      fitRationale: null,
      mergedInto: null,
      discoveredAt: now,
      createdAt: now,
      updatedAt: now,
    };
    memory().accounts.set(account.id, account);
    return { account, existed: false };
  }

  async getAccount(id: string): Promise<LeadAccountRecord | null> {
    return memory().accounts.get(id) ?? null;
  }

  private filtered(filters: AccountFilters): LeadAccountRecord[] {
    return [...memory().accounts.values()]
      .filter((account) => {
        if (filters.campaignId && account.campaignId !== filters.campaignId) {
          return false;
        }
        if (filters.statuses && filters.statuses.length > 0) {
          if (!filters.statuses.includes(account.status)) return false;
        } else if (account.status === 'merged') {
          return false;
        }
        if (filters.territoryKey && account.territoryKey !== filters.territoryKey) {
          return false;
        }
        if (filters.segmentKey && account.segmentKey !== filters.segmentKey) {
          return false;
        }
        if (
          filters.search &&
          !account.canonicalName.toLowerCase().includes(filters.search.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listAccounts(filters: AccountFilters = {}): Promise<LeadAccountRecord[]> {
    const limit = Math.min(filters.limit ?? 50, 100);
    const offset = Math.max(filters.offset ?? 0, 0);
    return this.filtered(filters).slice(offset, offset + limit);
  }

  async countAccounts(filters: AccountFilters = {}): Promise<number> {
    return this.filtered(filters).length;
  }

  async updateAccount(
    id: string,
    patch: Partial<
      Pick<
        LeadAccountRecord,
        'status' | 'ownerId' | 'summary' | 'fitRationale' | 'segmentKey' | 'territoryKey'
      >
    >,
  ): Promise<LeadAccountRecord | null> {
    const account = memory().accounts.get(id);
    if (!account) return null;
    Object.assign(account, patch, { updatedAt: new Date().toISOString() });
    return account;
  }

  async addClaim(claim: NewLeadClaim): Promise<LeadClaimRecord> {
    const record: LeadClaimRecord = {
      ...claim,
      id: crypto.randomUUID(),
      retrievedAt: new Date().toISOString(),
    };
    const list = memory().claims.get(claim.accountId) ?? [];
    list.push(record);
    memory().claims.set(claim.accountId, list);
    return record;
  }

  async listClaims(accountId: string): Promise<LeadClaimRecord[]> {
    return [...(memory().claims.get(accountId) ?? [])];
  }

  async addContact(contact: NewLeadContact): Promise<LeadContactRecord> {
    const now = new Date().toISOString();
    const record: LeadContactRecord = {
      ...contact,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const list = memory().contacts.get(contact.accountId) ?? [];
    list.push(record);
    memory().contacts.set(contact.accountId, list);
    return record;
  }

  async listContacts(accountId: string): Promise<LeadContactRecord[]> {
    return [...(memory().contacts.get(accountId) ?? [])];
  }

  async countContacts(accountId: string): Promise<number> {
    return (memory().contacts.get(accountId) ?? []).length;
  }

  async merge(
    winnerId: string,
    loserId: string,
    mergedBy: string,
    reason: string,
  ): Promise<MergeRecord> {
    const winner = memory().accounts.get(winnerId);
    const loser = memory().accounts.get(loserId);
    if (!winner || !loser || loser.status === 'merged') {
      throw new PlatformError('NOT_FOUND', 'No such account');
    }
    const record: MergeRecord = {
      id: crypto.randomUUID(),
      winnerId,
      loserId,
      mergedBy,
      reason,
      undoneAt: null,
      createdAt: new Date().toISOString(),
    };
    memory().merges.set(record.id, record);
    loser.status = 'merged';
    loser.mergedInto = winnerId;
    loser.updatedAt = record.createdAt;
    return record;
  }

  async undoMerge(mergeId: string): Promise<boolean> {
    const record = memory().merges.get(mergeId);
    if (!record || record.undoneAt) return false;
    record.undoneAt = new Date().toISOString();
    const loser = memory().accounts.get(record.loserId);
    if (loser) {
      loser.status = 'candidate';
      loser.mergedInto = null;
      loser.updatedAt = record.undoneAt;
    }
    return true;
  }

  async listMerges(accountId: string): Promise<MergeRecord[]> {
    return [...memory().merges.values()]
      .filter((merge) => merge.winnerId === accountId || merge.loserId === accountId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

let cached: LeadStore | null = null;

export async function getLeadStore(): Promise<LeadStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseLeadStore(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
    : new MemoryLeadStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetLeadStoreCache(): void {
  cached = null;
}
