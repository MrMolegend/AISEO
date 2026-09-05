import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { LinkedInIdentity } from '@/lib/linkedin/provider';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Stored provider connections: the identity fields an employee's consented
 * link actually returned, plus the scopes that were granted. No tokens.
 * Disconnecting deletes the row entirely.
 */

export interface ProviderConnectionRecord {
  userId: string;
  provider: 'linkedin';
  externalId: string | null;
  displayName: string | null;
  email: string | null;
  grantedScopes: string[];
  linkedAt: string;
}

export interface ConnectionStore {
  readonly name: string;
  upsertLinkedIn(
    userId: string,
    identity: LinkedInIdentity,
  ): Promise<ProviderConnectionRecord>;
  getLinkedIn(userId: string): Promise<ProviderConnectionRecord | null>;
  deleteLinkedIn(userId: string): Promise<boolean>;
}

type Row = Database['public']['Tables']['provider_connections']['Row'];

function rowToRecord(row: Row): ProviderConnectionRecord {
  return {
    userId: row.user_id,
    provider: 'linkedin',
    externalId: row.external_id,
    displayName: row.display_name,
    email: row.email,
    grantedScopes: row.granted_scopes,
    linkedAt: row.linked_at,
  };
}

export class SupabaseConnectionStore implements ConnectionStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async upsertLinkedIn(
    userId: string,
    identity: LinkedInIdentity,
  ): Promise<ProviderConnectionRecord> {
    const { data, error } = await this.client
      .from('provider_connections')
      .upsert(
        {
          user_id: userId,
          provider: 'linkedin',
          external_id: identity.externalId,
          display_name: identity.displayName,
          email: identity.email,
          granted_scopes: identity.grantedScopes,
        },
        { onConflict: 'user_id,provider' },
      )
      .select('*')
      .single<Row>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not save the connection', {
        cause: error,
      });
    }
    return rowToRecord(data);
  }

  async getLinkedIn(userId: string): Promise<ProviderConnectionRecord | null> {
    const { data, error } = await this.client
      .from('provider_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'linkedin')
      .maybeSingle<Row>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the connection', {
        cause: error,
      });
    }
    return data ? rowToRecord(data) : null;
  }

  async deleteLinkedIn(userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('provider_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'linkedin')
      .select('user_id')
      .maybeSingle<{ user_id: string }>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not remove the connection', {
        cause: error,
      });
    }
    return Boolean(data);
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  connections: Map<string, ProviderConnectionRecord>;
}

const MEMORY_KEY = Symbol.for('alt.connection-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { connections: new Map() };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryConnectionStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryConnectionStore implements ConnectionStore {
  readonly name = 'memory';

  async upsertLinkedIn(
    userId: string,
    identity: LinkedInIdentity,
  ): Promise<ProviderConnectionRecord> {
    const record: ProviderConnectionRecord = {
      userId,
      provider: 'linkedin',
      externalId: identity.externalId,
      displayName: identity.displayName,
      email: identity.email,
      grantedScopes: identity.grantedScopes,
      linkedAt: new Date().toISOString(),
    };
    memory().connections.set(userId, record);
    return record;
  }

  async getLinkedIn(userId: string): Promise<ProviderConnectionRecord | null> {
    return memory().connections.get(userId) ?? null;
  }

  async deleteLinkedIn(userId: string): Promise<boolean> {
    return memory().connections.delete(userId);
  }
}

let cached: ConnectionStore | null = null;

export async function getConnectionStore(): Promise<ConnectionStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseConnectionStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryConnectionStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetConnectionStoreCache(): void {
  cached = null;
}
