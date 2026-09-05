import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { getEnv, hasSupabase } from '@/lib/env';
import { logger } from '@/lib/observability/logger';
import { digestsEqual, hashShareToken, mintShareToken } from './tokens';

/**
 * Share link storage.
 *
 * The owner mints links deliberately; each is revocable, optionally expiring,
 * and audited. The raw token appears in create()'s return value and nowhere
 * else — not in this table, not in share_events, not in a log line.
 *
 * resolve() is the security boundary the public share page stands on. It
 * answers with the share only when the link is live; expired and revoked
 * links record a 'denied' event against the link they matched, and unknown
 * tokens record nothing (there is no row to attribute them to — the rate
 * limiter, not the audit trail, is the defence against guessing).
 */

export interface ShareLinkRecord {
  id: string;
  userId: string;
  jobId: string;
  label: string | null;
  allowDownload: boolean;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
}

export interface CreateShareInput {
  jobId: string;
  label?: string | null;
  allowDownload?: boolean;
  /** Days until expiry; null or absent means the link lives until revoked. */
  expiresInDays?: number | null;
}

export type ShareEventKind = 'created' | 'viewed' | 'denied' | 'revoked';

export interface ShareEventRecord {
  shareId: string;
  event: ShareEventKind;
  ipHash: string | null;
  createdAt: string;
}

export interface ResolvedShare {
  share: ShareLinkRecord;
  /** Live right now: not revoked, not expired. */
  valid: boolean;
}

export interface ShareLinkStore {
  readonly name: string;
  /** Mints the token. The raw token is returned once and never stored. */
  create(
    userId: string,
    input: CreateShareInput,
  ): Promise<{ share: ShareLinkRecord; rawToken: string }>;
  /**
   * Looks a presented token up by digest. Returns null for a token that
   * matches nothing; a ResolvedShare (valid or not) when a row matched.
   * Records 'viewed' or 'denied' and touches usage counters itself.
   */
  resolve(rawToken: string, ipHash: string | null): Promise<ResolvedShare | null>;
  listForJob(userId: string, jobId: string): Promise<ShareLinkRecord[]>;
  listForUser(userId: string, limit?: number): Promise<ShareLinkRecord[]>;
  revoke(id: string, userId: string): Promise<boolean>;
  /** Revoke every live link the user holds; account deletion calls this. */
  revokeAllForUser(userId: string): Promise<number>;
  /** Admin console reading; caller must have passed requireAdmin(). */
  recentEvents(limit?: number): Promise<ShareEventRecord[]>;
}

type ShareRow = Database['public']['Tables']['share_links']['Row'];
type ShareEventRow = Database['public']['Tables']['share_events']['Row'];

function toIsoUtc(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function rowToRecord(row: ShareRow): ShareLinkRecord {
  return {
    id: row.id,
    userId: row.user_id,
    jobId: row.job_id,
    label: row.label,
    allowDownload: row.allow_download,
    expiresAt: row.expires_at ? toIsoUtc(row.expires_at) : null,
    revokedAt: row.revoked_at ? toIsoUtc(row.revoked_at) : null,
    createdAt: toIsoUtc(row.created_at),
    lastUsedAt: row.last_used_at ? toIsoUtc(row.last_used_at) : null,
    useCount: row.use_count,
  };
}

export function shareIsLive(share: ShareLinkRecord, now = Date.now()): boolean {
  if (share.revokedAt) return false;
  if (share.expiresAt && new Date(share.expiresAt).getTime() <= now) return false;
  return true;
}

function expiryFromDays(expiresInDays: number | null | undefined): string | null {
  if (!expiresInDays || expiresInDays <= 0) return null;
  const days = Math.min(expiresInDays, 365);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export class SupabaseShareLinkStore implements ShareLinkStore {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async recordEvent(
    shareId: string,
    event: ShareEventKind,
    ipHash: string | null,
  ): Promise<void> {
    const { error } = await this.client
      .from('share_events')
      .insert({ share_id: shareId, event, ip_hash: ipHash });
    // The audit trail is best-effort; access decisions never depend on it.
    if (error) {
      logger.warn('share.audit_write_failed', { shareId, event, error: error.message });
    }
  }

  async create(
    userId: string,
    input: CreateShareInput,
  ): Promise<{ share: ShareLinkRecord; rawToken: string }> {
    const rawToken = mintShareToken();

    const { data, error } = await this.client
      .from('share_links')
      .insert({
        user_id: userId,
        job_id: input.jobId,
        token_hash: hashShareToken(rawToken),
        label: input.label ?? null,
        allow_download: input.allowDownload ?? false,
        expires_at: expiryFromDays(input.expiresInDays),
      })
      .select('*')
      .single<ShareRow>();

    if (error || !data) {
      throw new PlatformError('STORAGE_ERROR', 'Could not create the share link', {
        cause: error,
      });
    }
    const share = rowToRecord(data);
    await this.recordEvent(share.id, 'created', null);
    return { share, rawToken };
  }

  async resolve(rawToken: string, ipHash: string | null): Promise<ResolvedShare | null> {
    const { data, error } = await this.client
      .from('share_links')
      .select('*')
      .eq('token_hash', hashShareToken(rawToken))
      .maybeSingle<ShareRow>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not check the share link', {
        cause: error,
      });
    }
    if (!data) return null;

    const share = rowToRecord(data);
    const valid = shareIsLive(share);

    if (valid) {
      const { error: touchError } = await this.client
        .from('share_links')
        .update({
          last_used_at: new Date().toISOString(),
          use_count: share.useCount + 1,
        })
        .eq('id', share.id);
      if (touchError) {
        logger.warn('share.touch_failed', {
          shareId: share.id,
          error: touchError.message,
        });
      }
      await this.recordEvent(share.id, 'viewed', ipHash);
    } else {
      await this.recordEvent(share.id, 'denied', ipHash);
    }
    return { share, valid };
  }

  async listForJob(userId: string, jobId: string): Promise<ShareLinkRecord[]> {
    const { data, error } = await this.client
      .from('share_links')
      .select('*')
      .eq('user_id', userId)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list share links', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as ShareRow));
  }

  async listForUser(userId: string, limit = 100): Promise<ShareLinkRecord[]> {
    const { data, error } = await this.client
      .from('share_links')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not list share links', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => rowToRecord(row as ShareRow));
  }

  async revoke(id: string, userId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not revoke the share link', {
        cause: error,
      });
    }
    if (data) await this.recordEvent(id, 'revoked', null);
    return Boolean(data);
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const { data, error } = await this.client
      .from('share_links')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null)
      .select('id');

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not revoke share links', {
        cause: error,
      });
    }
    for (const row of data ?? []) {
      await this.recordEvent((row as { id: string }).id, 'revoked', null);
    }
    return (data ?? []).length;
  }

  async recentEvents(limit = 100): Promise<ShareEventRecord[]> {
    const { data, error } = await this.client
      .from('share_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 500));

    if (error) {
      throw new PlatformError('STORAGE_ERROR', 'Could not read share events', {
        cause: error,
      });
    }
    return (data ?? []).map((row) => {
      const event = row as ShareEventRow;
      return {
        shareId: event.share_id,
        event: event.event as ShareEventKind,
        ipHash: event.ip_hash,
        createdAt: toIsoUtc(event.created_at),
      };
    });
  }
}

/* ─────────────────────────── In-memory driver ─────────────────────────────── */

interface MemoryShare extends ShareLinkRecord {
  tokenHash: string;
}

interface MemoryState {
  shares: Map<string, MemoryShare>;
  events: ShareEventRecord[];
}

const MEMORY_KEY = Symbol.for('corridor.share-store');

function memory(): MemoryState {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  if (!holder[MEMORY_KEY]) holder[MEMORY_KEY] = { shares: new Map(), events: [] };
  return holder[MEMORY_KEY]!;
}

export function resetMemoryShareStore(): void {
  const holder = globalThis as unknown as Record<symbol, MemoryState | undefined>;
  holder[MEMORY_KEY] = undefined;
}

export class MemoryShareLinkStore implements ShareLinkStore {
  readonly name = 'memory';

  private record(shareId: string, event: ShareEventKind, ipHash: string | null): void {
    memory().events.unshift({
      shareId,
      event,
      ipHash,
      createdAt: new Date().toISOString(),
    });
  }

  async create(
    userId: string,
    input: CreateShareInput,
  ): Promise<{ share: ShareLinkRecord; rawToken: string }> {
    const rawToken = mintShareToken();
    const share: MemoryShare = {
      id: crypto.randomUUID(),
      userId,
      jobId: input.jobId,
      label: input.label ?? null,
      allowDownload: input.allowDownload ?? false,
      expiresAt: expiryFromDays(input.expiresInDays),
      revokedAt: null,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      useCount: 0,
      tokenHash: hashShareToken(rawToken),
    };
    memory().shares.set(share.id, share);
    this.record(share.id, 'created', null);
    const { tokenHash: _hash, ...visible } = share;
    return { share: visible, rawToken };
  }

  async resolve(rawToken: string, ipHash: string | null): Promise<ResolvedShare | null> {
    const digest = hashShareToken(rawToken);
    for (const share of memory().shares.values()) {
      if (!digestsEqual(share.tokenHash, digest)) continue;
      const valid = shareIsLive(share);
      if (valid) {
        share.lastUsedAt = new Date().toISOString();
        share.useCount += 1;
        this.record(share.id, 'viewed', ipHash);
      } else {
        this.record(share.id, 'denied', ipHash);
      }
      const { tokenHash: _hash, ...visible } = share;
      return { share: { ...visible }, valid };
    }
    return null;
  }

  async listForJob(userId: string, jobId: string): Promise<ShareLinkRecord[]> {
    return [...memory().shares.values()]
      .filter((share) => share.userId === userId && share.jobId === jobId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ tokenHash: _hash, ...visible }) => visible);
  }

  async listForUser(userId: string, limit = 100): Promise<ShareLinkRecord[]> {
    return [...memory().shares.values()]
      .filter((share) => share.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.min(limit, 200))
      .map(({ tokenHash: _hash, ...visible }) => visible);
  }

  async revoke(id: string, userId: string): Promise<boolean> {
    const share = memory().shares.get(id);
    if (!share || share.userId !== userId || share.revokedAt) return false;
    share.revokedAt = new Date().toISOString();
    this.record(id, 'revoked', null);
    return true;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    let revoked = 0;
    for (const share of memory().shares.values()) {
      if (share.userId === userId && !share.revokedAt) {
        share.revokedAt = new Date().toISOString();
        this.record(share.id, 'revoked', null);
        revoked += 1;
      }
    }
    return revoked;
  }

  async recentEvents(limit = 100): Promise<ShareEventRecord[]> {
    return memory().events.slice(0, Math.min(limit, 500));
  }
}

let cached: ShareLinkStore | null = null;

export async function getShareLinkStore(): Promise<ShareLinkStore> {
  if (cached) return cached;

  const env = getEnv();
  cached = hasSupabase(env)
    ? new SupabaseShareLinkStore(
        env.NEXT_PUBLIC_SUPABASE_URL!,
        env.SUPABASE_SERVICE_ROLE_KEY!,
      )
    : new MemoryShareLinkStore();

  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetShareLinkStoreCache(): void {
  cached = null;
}
