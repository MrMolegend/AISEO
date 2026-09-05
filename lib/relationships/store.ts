import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import { VERIFIED_DIRECT_STATES, type RelationshipState } from '@/schemas/relationship';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * The relationship graph.
 *
 * One edge per (employee, contact), upserted: a person's latest word about
 * a contact replaces their earlier one, and the audit trail keeps the
 * history. The store enforces the schema's honesty rule in code as well:
 * a verified-direct state can only be written with provenance naming an
 * employee confirmation or an official API response.
 */

export interface RelationshipRecord {
  id: string;
  employeeId: string;
  contactId: string;
  state: RelationshipState;
  provenance: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  confidence: 'low' | 'medium' | 'high';
  note: string | null;
  expiresOn: string | null;
  visibility: 'workspace' | 'private';
  createdAt: string;
  updatedAt: string;
}

export interface NewRelationship {
  employeeId: string;
  contactId: string;
  state: RelationshipState;
  provenance: string;
  confirmedBy?: string | null;
  confidence?: 'low' | 'medium' | 'high';
  note?: string | null;
  expiresOn?: string | null;
  visibility?: 'workspace' | 'private';
}

const VERIFIED_PROVENANCE = /^(employee_confirmation|official_linkedin_api):/;

function assertHonest(edge: NewRelationship): void {
  if (
    VERIFIED_DIRECT_STATES.includes(edge.state) &&
    !VERIFIED_PROVENANCE.test(edge.provenance)
  ) {
    throw new PlatformError(
      'INVALID_INPUT',
      'A verified direct connection requires employee confirmation or an official API response as provenance.',
    );
  }
}

export interface RelationshipStore {
  readonly name: string;
  upsert(edge: NewRelationship): Promise<RelationshipRecord>;
  forContact(contactId: string): Promise<RelationshipRecord[]>;
  forEmployee(employeeId: string): Promise<RelationshipRecord[]>;
  get(employeeId: string, contactId: string): Promise<RelationshipRecord | null>;
}

type Row = Database['public']['Tables']['relationships']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: Row): RelationshipRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    contactId: row.contact_id,
    state: row.state as RelationshipState,
    provenance: row.provenance,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at ? toIsoUtc(row.confirmed_at) : null,
    confidence: row.confidence as RelationshipRecord['confidence'],
    note: row.note,
    expiresOn: row.expires_on,
    visibility: row.visibility as RelationshipRecord['visibility'],
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

export class SupabaseRelationshipStore implements RelationshipStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsert(edge: NewRelationship): Promise<RelationshipRecord> {
    assertHonest(edge);
    const { data, error } = await this.client
      .from('relationships')
      .upsert(
        {
          employee_id: edge.employeeId,
          contact_id: edge.contactId,
          state: edge.state,
          provenance: edge.provenance,
          confirmed_by: edge.confirmedBy ?? null,
          confirmed_at: edge.confirmedBy ? new Date().toISOString() : null,
          confidence: edge.confidence ?? 'medium',
          note: edge.note ?? null,
          expires_on: edge.expiresOn ?? null,
          visibility: edge.visibility ?? 'workspace',
        },
        { onConflict: 'employee_id,contact_id' },
      )
      .select('*')
      .single<Row>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the relationship', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async forContact(contactId: string): Promise<RelationshipRecord[]> {
    const { data, error } = await this.client
      .from('relationships')
      .select('*')
      .eq('contact_id', contactId)
      .limit(100);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read relationships', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as Row));
  }

  async forEmployee(employeeId: string): Promise<RelationshipRecord[]> {
    const { data, error } = await this.client
      .from('relationships')
      .select('*')
      .eq('employee_id', employeeId)
      .order('updated_at', { ascending: false })
      .limit(200);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read relationships', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as Row));
  }

  async get(employeeId: string, contactId: string): Promise<RelationshipRecord | null> {
    const { data, error } = await this.client
      .from('relationships')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('contact_id', contactId)
      .maybeSingle<Row>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the relationship', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  edges: Map<string, RelationshipRecord>;
}

const MEMORY_KEY = Symbol.for('alt.relationship-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { edges: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryRelationshipStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryRelationshipStore implements RelationshipStore {
  readonly name = 'memory';

  async upsert(edge: NewRelationship): Promise<RelationshipRecord> {
    assertHonest(edge);
    const key = `${edge.employeeId}:${edge.contactId}`;
    const existing = memory().edges.get(key);
    const now = new Date().toISOString();
    const record: RelationshipRecord = {
      id: existing?.id ?? crypto.randomUUID(),
      employeeId: edge.employeeId,
      contactId: edge.contactId,
      state: edge.state,
      provenance: edge.provenance,
      confirmedBy: edge.confirmedBy ?? null,
      confirmedAt: edge.confirmedBy ? now : null,
      confidence: edge.confidence ?? 'medium',
      note: edge.note ?? null,
      expiresOn: edge.expiresOn ?? null,
      visibility: edge.visibility ?? 'workspace',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    memory().edges.set(key, record);
    return record;
  }

  async forContact(contactId: string): Promise<RelationshipRecord[]> {
    return [...memory().edges.values()].filter((edge) => edge.contactId === contactId);
  }

  async forEmployee(employeeId: string): Promise<RelationshipRecord[]> {
    return [...memory().edges.values()]
      .filter((edge) => edge.employeeId === employeeId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(employeeId: string, contactId: string): Promise<RelationshipRecord | null> {
    return memory().edges.get(`${employeeId}:${contactId}`) ?? null;
  }
}

let cached: RelationshipStore | null = null;

export async function getRelationshipStore(): Promise<RelationshipStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseRelationshipStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryRelationshipStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetRelationshipStoreCache(): void {
  cached = null;
}
