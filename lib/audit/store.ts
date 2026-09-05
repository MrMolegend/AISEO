import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * The audit trail.
 *
 * Append-only by design and by grant: the service role can insert and select,
 * never update or delete (migration 0017). Writes are best-effort at call
 * sites that must not fail the user's action over a lost audit row — the
 * helper in lib/auth/membership.ts wraps them accordingly — but reads are
 * exact.
 *
 * Metadata is small structured context (entity names, before/after values),
 * never secrets, tokens, or free-form dumps.
 */

export interface AuditEventInput {
  actorId: string | null;
  action: string;
  entityKind: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AuditEventRecord extends AuditEventInput {
  id: number;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuditStore {
  readonly name: string;
  append(event: AuditEventInput): Promise<void>;
  recent(limit?: number): Promise<AuditEventRecord[]>;
  forEntity(
    entityKind: string,
    entityId: string,
    limit?: number,
  ): Promise<AuditEventRecord[]>;
}

type AuditRow = Database['public']['Tables']['ops_audit_events']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: AuditRow): AuditEventRecord {
  return {
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: toIsoUtc(row.created_at),
  };
}

export class SupabaseAuditStore implements AuditStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async append(event: AuditEventInput): Promise<void> {
    const { error } = await this.client.from('ops_audit_events').insert({
      actor_id: event.actorId,
      action: event.action,
      entity_kind: event.entityKind,
      entity_id: event.entityId ?? null,
      metadata: (event.metadata ?? {}) as never,
    });
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not record the audit event', {
        cause: error,
      });
    }
  }

  async recent(limit = 100): Promise<AuditEventRecord[]> {
    const { data, error } = await this.client
      .from('ops_audit_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the audit trail', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as AuditRow));
  }

  async forEntity(
    entityKind: string,
    entityId: string,
    limit = 100,
  ): Promise<AuditEventRecord[]> {
    const { data, error } = await this.client
      .from('ops_audit_events')
      .select('*')
      .eq('entity_kind', entityKind)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the audit trail', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as AuditRow));
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  events: AuditEventRecord[];
  nextId: number;
}

const MEMORY_KEY = Symbol.for('alt.audit-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { events: [], nextId: 1 };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryAuditStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryAuditStore implements AuditStore {
  readonly name = 'memory';

  async append(event: AuditEventInput): Promise<void> {
    const state = memory();
    state.events.push({
      id: state.nextId++,
      actorId: event.actorId,
      action: event.action,
      entityKind: event.entityKind,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? {},
      createdAt: new Date().toISOString(),
    });
  }

  async recent(limit = 100): Promise<AuditEventRecord[]> {
    return [...memory().events].reverse().slice(0, Math.min(limit, 500));
  }

  async forEntity(
    entityKind: string,
    entityId: string,
    limit = 100,
  ): Promise<AuditEventRecord[]> {
    return [...memory().events]
      .filter((e) => e.entityKind === entityKind && e.entityId === entityId)
      .reverse()
      .slice(0, Math.min(limit, 500));
  }
}

let cached: AuditStore | null = null;

export async function getAuditStore(): Promise<AuditStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseAuditStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryAuditStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetAuditStoreCache(): void {
  cached = null;
}
