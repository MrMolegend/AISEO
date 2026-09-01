import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { BusinessProfileInput } from '@/schemas/business-profile';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Business profile storage.
 *
 * Two drivers behind one interface, as everywhere else. The access rule is the
 * same one the job store established: the owner's id is part of every query,
 * so a row that is not the caller's never leaves the database — there is no
 * comparison after the fact to forget.
 *
 * Profiles archive rather than delete. A profile that seeded reports is part
 * of their provenance; archived_at hides it from pickers and the profile list
 * without unpicking history. Rows leave the table only with the account.
 */

export interface BusinessProfileRecord extends BusinessProfileInput {
  id: string;
  userId: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfileStore {
  readonly name: string;
  create(userId: string, input: BusinessProfileInput): Promise<BusinessProfileRecord>;
  /** Full replace of the editable fields. Returns null when not the owner's. */
  update(
    id: string,
    userId: string,
    input: BusinessProfileInput,
  ): Promise<BusinessProfileRecord | null>;
  setArchived(id: string, userId: string, archived: boolean): Promise<boolean>;
  getForUser(id: string, userId: string): Promise<BusinessProfileRecord | null>;
  listForUser(
    userId: string,
    options?: { includeArchived?: boolean; limit?: number },
  ): Promise<BusinessProfileRecord[]>;
}

type ProfileRow = Database['public']['Tables']['business_profiles']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: ProfileRow): BusinessProfileRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    websiteUrl: row.website_url,
    description: row.description,
    homeCountry: row.home_country,
    industry: row.industry,
    offerings: row.offerings,
    targetCustomers: row.target_customers,
    buyerRoles: row.buyer_roles,
    businessModel: row.business_model as BusinessProfileRecord['businessModel'],
    pricePositioning: row.price_positioning as BusinessProfileRecord['pricePositioning'],
    salesChannels: row.sales_channels,
    tractionStage: row.traction_stage as BusinessProfileRecord['tractionStage'],
    teamCapacity: row.team_capacity,
    differentiators: row.differentiators,
    constraintsNotes: row.constraints_notes,
    goals: row.goals,
    knownCompetitors: row.known_competitors,
    customerEvidence: row.customer_evidence,
    archivedAt: row.archived_at ? toIsoUtc(row.archived_at) : null,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

function inputToRow(input: BusinessProfileInput) {
  return {
    name: input.name,
    website_url: input.websiteUrl,
    description: input.description,
    home_country: input.homeCountry,
    industry: input.industry,
    offerings: input.offerings,
    target_customers: input.targetCustomers,
    buyer_roles: input.buyerRoles,
    business_model: input.businessModel,
    price_positioning: input.pricePositioning,
    sales_channels: input.salesChannels,
    traction_stage: input.tractionStage,
    team_capacity: input.teamCapacity,
    differentiators: input.differentiators,
    constraints_notes: input.constraintsNotes,
    goals: input.goals,
    known_competitors: input.knownCompetitors,
    customer_evidence: input.customerEvidence,
  };
}

export class SupabaseBusinessProfileStore implements BusinessProfileStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async create(
    userId: string,
    input: BusinessProfileInput,
  ): Promise<BusinessProfileRecord> {
    const { data, error } = await this.client
      .from('business_profiles')
      .insert({ user_id: userId, ...inputToRow(input) })
      .select('*')
      .single<ProfileRow>();

    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the profile', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async update(
    id: string,
    userId: string,
    input: BusinessProfileInput,
  ): Promise<BusinessProfileRecord | null> {
    const { data, error } = await this.client
      .from('business_profiles')
      .update(inputToRow(input))
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle<ProfileRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the profile', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async setArchived(id: string, userId: string, archived: boolean): Promise<boolean> {
    const { data, error } = await this.client
      .from('business_profiles')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the profile', {
        cause: error,
      });
    }
    return Boolean(data);
  }

  async getForUser(id: string, userId: string): Promise<BusinessProfileRecord | null> {
    const { data, error } = await this.client
      .from('business_profiles')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle<ProfileRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the profile', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async listForUser(
    userId: string,
    options: { includeArchived?: boolean; limit?: number } = {},
  ): Promise<BusinessProfileRecord[]> {
    let query = this.client
      .from('business_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(Math.min(options.limit ?? 50, 100));

    if (!options.includeArchived) {
      query = query.is('archived_at', null);
    }

    const { data, error } = await query;
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list your profiles', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as ProfileRow));
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  profiles: Map<string, BusinessProfileRecord>;
}

const MEMORY_KEY = Symbol.for('corridor.profile-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { profiles: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryProfileStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryBusinessProfileStore implements BusinessProfileStore {
  readonly name = 'memory';

  async create(
    userId: string,
    input: BusinessProfileInput,
  ): Promise<BusinessProfileRecord> {
    const now = new Date().toISOString();
    const record: BusinessProfileRecord = {
      ...input,
      id: crypto.randomUUID(),
      userId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    memory().profiles.set(record.id, record);
    return record;
  }

  async update(
    id: string,
    userId: string,
    input: BusinessProfileInput,
  ): Promise<BusinessProfileRecord | null> {
    const existing = memory().profiles.get(id);
    if (!existing || existing.userId !== userId) return null;
    const next: BusinessProfileRecord = {
      ...existing,
      ...input,
      updatedAt: new Date().toISOString(),
    };
    memory().profiles.set(id, next);
    return next;
  }

  async setArchived(id: string, userId: string, archived: boolean): Promise<boolean> {
    const existing = memory().profiles.get(id);
    if (!existing || existing.userId !== userId) return false;
    existing.archivedAt = archived ? new Date().toISOString() : null;
    existing.updatedAt = new Date().toISOString();
    return true;
  }

  async getForUser(id: string, userId: string): Promise<BusinessProfileRecord | null> {
    const existing = memory().profiles.get(id);
    return existing && existing.userId === userId ? existing : null;
  }

  async listForUser(
    userId: string,
    options: { includeArchived?: boolean; limit?: number } = {},
  ): Promise<BusinessProfileRecord[]> {
    return [...memory().profiles.values()]
      .filter(
        (profile) =>
          profile.userId === userId &&
          (options.includeArchived || profile.archivedAt === null),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.min(options.limit ?? 50, 100));
  }
}

let cached: BusinessProfileStore | null = null;

export async function getBusinessProfileStore(): Promise<BusinessProfileStore> {
  if (cached) return cached;

  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseBusinessProfileStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryBusinessProfileStore();

  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetBusinessProfileStoreCache(): void {
  cached = null;
}
