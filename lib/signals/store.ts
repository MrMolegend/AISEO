import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import type { SignalKind } from '@/schemas/signals';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';

/**
 * Watchlists and signals.
 *
 * The store enforces two shapes the check service depends on: signal
 * insertion is idempotent per (watchlist, url) — a re-check converges
 * instead of duplicating — and the daily check bookkeeping lives on the
 * watchlist row itself, so "how many checks ran today, everywhere" is a
 * sum over rows rather than a ledger that could drift.
 */

export interface WatchlistRecord {
  id: string;
  ownerId: string;
  name: string;
  kind: 'account' | 'segment';
  accountId: string | null;
  segmentKey: string | null;
  territoryKey: string | null;
  active: boolean;
  lastCheckedOn: string | null;
  checksToday: number;
  createdAt: string;
}

export interface NewWatchlist {
  ownerId: string;
  name: string;
  kind: 'account' | 'segment';
  accountId: string | null;
  segmentKey: string | null;
  territoryKey: string | null;
}

export interface SignalRecord {
  id: string;
  watchlistId: string;
  accountId: string | null;
  kind: SignalKind;
  title: string;
  url: string;
  sourceHost: string;
  excerpt: string | null;
  dismissed: boolean;
  createdAt: string;
}

export interface NewSignal {
  watchlistId: string;
  accountId: string | null;
  kind: SignalKind;
  title: string;
  url: string;
  sourceHost: string;
  excerpt: string | null;
}

export interface SignalStore {
  readonly name: string;
  createWatchlist(input: NewWatchlist): Promise<WatchlistRecord>;
  getWatchlist(id: string): Promise<WatchlistRecord | null>;
  listWatchlists(ownerId: string): Promise<WatchlistRecord[]>;
  /** Ownership-checked; returns false when the row is not the caller's. */
  deleteWatchlist(id: string, ownerId: string): Promise<boolean>;
  /**
   * Stamp one more check on the day given, resetting the counter when the
   * day has moved on since the last check.
   */
  recordCheck(id: string, day: string): Promise<WatchlistRecord | null>;
  /** Sum of checks recorded on the day given, across all watchlists. */
  checksUsedOn(day: string): Promise<number>;
  /** Inserts unless (watchlist, url) already exists. */
  addSignal(signal: NewSignal): Promise<{ signal: SignalRecord; existed: boolean }>;
  listSignals(watchlistId: string): Promise<SignalRecord[]>;
  /** Undismissed signals across all of a member's watchlists, newest first. */
  openSignalsForOwner(ownerId: string): Promise<SignalRecord[]>;
  dismissSignal(id: string): Promise<boolean>;
}

type WatchlistRow = Database['public']['Tables']['watchlists']['Row'];
type SignalRow = Database['public']['Tables']['signals']['Row'];

function watchlistRowToRecord(row: WatchlistRow): WatchlistRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    kind: row.kind as WatchlistRecord['kind'],
    accountId: row.account_id,
    segmentKey: row.segment_key,
    territoryKey: row.territory_key,
    active: row.active,
    lastCheckedOn: row.last_checked_on,
    checksToday: row.checks_today,
    createdAt: row.created_at,
  };
}

function signalRowToRecord(row: SignalRow): SignalRecord {
  return {
    id: row.id,
    watchlistId: row.watchlist_id,
    accountId: row.account_id,
    kind: row.kind as SignalKind,
    title: row.title,
    url: row.url,
    sourceHost: row.source_host,
    excerpt: row.excerpt,
    dismissed: row.dismissed,
    createdAt: row.created_at,
  };
}

export class SupabaseSignalStore implements SignalStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createWatchlist(input: NewWatchlist): Promise<WatchlistRecord> {
    const { data, error } = await this.client
      .from('watchlists')
      .insert({
        owner_id: input.ownerId,
        name: input.name,
        kind: input.kind,
        account_id: input.accountId,
        segment_key: input.segmentKey,
        territory_key: input.territoryKey,
      })
      .select('*')
      .single<WatchlistRow>();
    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the watch', {
        cause: error,
      });
    }
    return watchlistRowToRecord(data);
  }

  async getWatchlist(id: string): Promise<WatchlistRecord | null> {
    const { data, error } = await this.client
      .from('watchlists')
      .select('*')
      .eq('id', id)
      .maybeSingle<WatchlistRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read the watch', {
        cause: error,
      });
    }
    return data ? watchlistRowToRecord(data) : null;
  }

  async listWatchlists(ownerId: string): Promise<WatchlistRecord[]> {
    const { data, error } = await this.client
      .from('watchlists')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('active', true)
      .order('created_at', { ascending: false });
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list watches', {
        cause: error,
      });
    }
    return (data ?? []).map(watchlistRowToRecord);
  }

  async deleteWatchlist(id: string, ownerId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('watchlists')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId)
      .select('id');
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not delete the watch', {
        cause: error,
      });
    }
    return (data ?? []).length > 0;
  }

  async recordCheck(id: string, day: string): Promise<WatchlistRecord | null> {
    const existing = await this.getWatchlist(id);
    if (!existing) return null;
    const checks = existing.lastCheckedOn === day ? existing.checksToday + 1 : 1;
    const { data, error } = await this.client
      .from('watchlists')
      .update({ last_checked_on: day, checks_today: checks })
      .eq('id', id)
      .select('*')
      .maybeSingle<WatchlistRow>();
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not record the check', {
        cause: error,
      });
    }
    return data ? watchlistRowToRecord(data) : null;
  }

  async checksUsedOn(day: string): Promise<number> {
    const { data, error } = await this.client
      .from('watchlists')
      .select('checks_today')
      .eq('last_checked_on', day);
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not count checks', {
        cause: error,
      });
    }
    return (data ?? []).reduce((sum, row) => sum + (row.checks_today ?? 0), 0);
  }

  async addSignal(
    signal: NewSignal,
  ): Promise<{ signal: SignalRecord; existed: boolean }> {
    const { data, error } = await this.client
      .from('signals')
      .insert({
        watchlist_id: signal.watchlistId,
        account_id: signal.accountId,
        kind: signal.kind,
        title: signal.title,
        url: signal.url,
        source_host: signal.sourceHost,
        excerpt: signal.excerpt,
      })
      .select('*')
      .single<SignalRow>();
    if (error) {
      // 23505: the (watchlist, url) pair already exists — return that row.
      if (error.code === '23505') {
        const { data: existing } = await this.client
          .from('signals')
          .select('*')
          .eq('watchlist_id', signal.watchlistId)
          .eq('url', signal.url)
          .maybeSingle<SignalRow>();
        if (existing) return { signal: signalRowToRecord(existing), existed: true };
      }
      throw new PlatformError('STORAGE_ERROR', 'Could not save the signal', {
        cause: error,
      });
    }
    return { signal: signalRowToRecord(data!), existed: false };
  }

  async listSignals(watchlistId: string): Promise<SignalRecord[]> {
    const { data, error } = await this.client
      .from('signals')
      .select('*')
      .eq('watchlist_id', watchlistId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list signals', {
        cause: error,
      });
    }
    return (data ?? []).map(signalRowToRecord);
  }

  async openSignalsForOwner(ownerId: string): Promise<SignalRecord[]> {
    const watchlists = await this.listWatchlists(ownerId);
    if (watchlists.length === 0) return [];
    const { data, error } = await this.client
      .from('signals')
      .select('*')
      .in(
        'watchlist_id',
        watchlists.map((watchlist) => watchlist.id),
      )
      .eq('dismissed', false)
      .order('created_at', { ascending: false });
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list signals', {
        cause: error,
      });
    }
    return (data ?? []).map(signalRowToRecord);
  }

  async dismissSignal(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('signals')
      .update({ dismissed: true })
      .eq('id', id)
      .select('id');
    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not dismiss the signal', {
        cause: error,
      });
    }
    return (data ?? []).length > 0;
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryState {
  watchlists: Map<string, WatchlistRecord>;
  signals: Map<string, SignalRecord>;
}

const MEMORY_KEY = Symbol.for('alt.signal-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) {
    holder[MEMORY_KEY] = { watchlists: new Map(), signals: new Map() };
  }
  return holder[MEMORY_KEY]!;
}

export function resetMemorySignalStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemorySignalStore implements SignalStore {
  readonly name = 'memory';

  async createWatchlist(input: NewWatchlist): Promise<WatchlistRecord> {
    const record: WatchlistRecord = {
      id: crypto.randomUUID(),
      ownerId: input.ownerId,
      name: input.name,
      kind: input.kind,
      accountId: input.accountId,
      segmentKey: input.segmentKey,
      territoryKey: input.territoryKey,
      active: true,
      lastCheckedOn: null,
      checksToday: 0,
      createdAt: new Date().toISOString(),
    };
    memory().watchlists.set(record.id, record);
    return record;
  }

  async getWatchlist(id: string): Promise<WatchlistRecord | null> {
    return memory().watchlists.get(id) ?? null;
  }

  async listWatchlists(ownerId: string): Promise<WatchlistRecord[]> {
    return [...memory().watchlists.values()]
      .filter((watchlist) => watchlist.ownerId === ownerId && watchlist.active)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async deleteWatchlist(id: string, ownerId: string): Promise<boolean> {
    const existing = memory().watchlists.get(id);
    if (!existing || existing.ownerId !== ownerId) return false;
    memory().watchlists.delete(id);
    for (const [signalId, signal] of memory().signals) {
      if (signal.watchlistId === id) memory().signals.delete(signalId);
    }
    return true;
  }

  async recordCheck(id: string, day: string): Promise<WatchlistRecord | null> {
    const existing = memory().watchlists.get(id);
    if (!existing) return null;
    existing.checksToday = existing.lastCheckedOn === day ? existing.checksToday + 1 : 1;
    existing.lastCheckedOn = day;
    return existing;
  }

  async checksUsedOn(day: string): Promise<number> {
    return [...memory().watchlists.values()]
      .filter((watchlist) => watchlist.lastCheckedOn === day)
      .reduce((sum, watchlist) => sum + watchlist.checksToday, 0);
  }

  async addSignal(
    signal: NewSignal,
  ): Promise<{ signal: SignalRecord; existed: boolean }> {
    for (const existing of memory().signals.values()) {
      if (existing.watchlistId === signal.watchlistId && existing.url === signal.url) {
        return { signal: existing, existed: true };
      }
    }
    const record: SignalRecord = {
      id: crypto.randomUUID(),
      watchlistId: signal.watchlistId,
      accountId: signal.accountId,
      kind: signal.kind,
      title: signal.title,
      url: signal.url,
      sourceHost: signal.sourceHost,
      excerpt: signal.excerpt,
      dismissed: false,
      createdAt: new Date().toISOString(),
    };
    memory().signals.set(record.id, record);
    return { signal: record, existed: false };
  }

  async listSignals(watchlistId: string): Promise<SignalRecord[]> {
    return [...memory().signals.values()]
      .filter((signal) => signal.watchlistId === watchlistId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async openSignalsForOwner(ownerId: string): Promise<SignalRecord[]> {
    const owned = new Set(
      (await this.listWatchlists(ownerId)).map((watchlist) => watchlist.id),
    );
    return [...memory().signals.values()]
      .filter((signal) => owned.has(signal.watchlistId) && !signal.dismissed)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async dismissSignal(id: string): Promise<boolean> {
    const existing = memory().signals.get(id);
    if (!existing) return false;
    existing.dismissed = true;
    return true;
  }
}

let cached: SignalStore | null = null;

export async function getSignalStore(): Promise<SignalStore> {
  if (cached) return cached;
  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseSignalStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemorySignalStore();
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetSignalStoreCache(): void {
  cached = null;
}
