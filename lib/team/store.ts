import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { AltRole, MemberInput, MemberUpdate } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

export { ALT_ROLES, ROLE_LABEL, ROLE_DESCRIPTION } from '@/schemas/team';

/**
 * Team membership storage.
 *
 * The membership row is the authorisation record: role and territory scope
 * are read from here on every request (see lib/auth/membership.ts), so an
 * administrator's change takes effect immediately — no stale-JWT window.
 *
 * Members are revoked, never deleted, so the audit history they created
 * keeps a name. Rows leave the table only through the auth.users cascade.
 */

export interface TeamMemberRecord {
  userId: string;
  role: AltRole;
  displayName: string;
  territories: string[];
  status: 'active' | 'revoked';
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamStore {
  readonly name: string;
  get(userId: string): Promise<TeamMemberRecord | null>;
  list(): Promise<TeamMemberRecord[]>;
  /** Creates or reactivates a membership. Idempotent on user_id. */
  upsert(input: MemberInput, invitedBy: string | null): Promise<TeamMemberRecord>;
  update(userId: string, patch: MemberUpdate): Promise<TeamMemberRecord | null>;
}

type MemberRow = Database['public']['Tables']['team_members']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: MemberRow): TeamMemberRecord {
  return {
    userId: row.user_id,
    role: row.role as AltRole,
    displayName: row.display_name,
    territories: row.territories,
    status: row.status as TeamMemberRecord['status'],
    invitedBy: row.invited_by,
    createdAt: toIsoUtc(row.created_at),
    updatedAt: toIsoUtc(row.updated_at),
  };
}

export class SupabaseTeamStore implements TeamStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async get(userId: string): Promise<TeamMemberRecord | null> {
    const { data, error } = await this.client
      .from('team_members')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle<MemberRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the membership', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async list(): Promise<TeamMemberRecord[]> {
    const { data, error } = await this.client
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(500);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list the team', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as MemberRow));
  }

  async upsert(input: MemberInput, invitedBy: string | null): Promise<TeamMemberRecord> {
    const { data, error } = await this.client
      .from('team_members')
      .upsert(
        {
          user_id: input.userId,
          role: input.role,
          display_name: input.displayName,
          territories: input.territories,
          status: 'active',
          invited_by: invitedBy,
        },
        { onConflict: 'user_id' },
      )
      .select('*')
      .single<MemberRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the membership', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async update(userId: string, patch: MemberUpdate): Promise<TeamMemberRecord | null> {
    const row: Database['public']['Tables']['team_members']['Update'] = {};
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.territories !== undefined) row.territories = patch.territories;
    if (patch.status !== undefined) row.status = patch.status;

    const { data, error } = await this.client
      .from('team_members')
      .update(row)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle<MemberRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not update the membership', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  members: Map<string, TeamMemberRecord>;
}

const MEMORY_KEY = Symbol.for('alt.team-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { members: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryTeamStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryTeamStore implements TeamStore {
  readonly name = 'memory';

  async get(userId: string): Promise<TeamMemberRecord | null> {
    return memory().members.get(userId) ?? null;
  }

  async list(): Promise<TeamMemberRecord[]> {
    return [...memory().members.values()].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
  }

  async upsert(input: MemberInput, invitedBy: string | null): Promise<TeamMemberRecord> {
    const now = new Date().toISOString();
    const existing = memory().members.get(input.userId);
    const record: TeamMemberRecord = {
      userId: input.userId,
      role: input.role,
      displayName: input.displayName,
      territories: input.territories,
      status: 'active',
      invitedBy: existing?.invitedBy ?? invitedBy,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    memory().members.set(input.userId, record);
    return record;
  }

  async update(userId: string, patch: MemberUpdate): Promise<TeamMemberRecord | null> {
    const existing = memory().members.get(userId);
    if (!existing) return null;
    const next: TeamMemberRecord = {
      ...existing,
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.territories !== undefined ? { territories: patch.territories } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      updatedAt: new Date().toISOString(),
    };
    memory().members.set(userId, next);
    return next;
  }
}

let cached: TeamStore | null = null;

export async function getTeamStore(): Promise<TeamStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseTeamStore(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!)
    : new MemoryTeamStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetTeamStoreCache(): void {
  cached = null;
}
