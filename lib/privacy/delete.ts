import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getShareLinkStore } from '@/lib/share/store';
import { getEnv, hasSupabase } from '@/lib/env';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

/**
 * Account deletion.
 *
 * Order matters and is deliberate:
 *
 *   1. Revoke every live share link first, so nothing of the account remains
 *      reachable through a token that outlives it (and the revocations are
 *      audited while the rows still exist to audit against).
 *   2. Delete the auth user through the Auth admin API. Every table in this
 *      schema hangs off auth.users with ON DELETE CASCADE, so profiles,
 *      drafts, jobs, sources, scenarios, actions, feedback, share links and
 *      their events, the wallet and the ledger all go with it — one
 *      transaction boundary, no partial account left behind.
 *
 * Retention, stated truthfully: the ledger deletes WITH the account. That is
 * a decision migration 0006 made deliberately (the cascade requires it) and
 * the product documents — there is no invoicing built on the ledger, so
 * financial-record retention obligations sit with the payment provider when
 * one exists, not with this table. Operational logs never contained
 * identifying values to begin with (the logger redacts; rate limiting stores
 * salted hashes), so nothing needs anonymising after the fact.
 *
 * Without Supabase configured (local dev, tests) there is no durable account
 * to delete: shares are revoked and the caller clears the session.
 */
export interface DeletionResult {
  sharesRevoked: number;
  authUserDeleted: boolean;
}

export async function deleteAccount(userId: string): Promise<DeletionResult> {
  const shares = await getShareLinkStore();
  const sharesRevoked = await shares.revokeAllForUser(userId);

  const env = getEnv();
  if (!hasSupabase(env)) {
    logger.info('account.deleted_memory_mode', { userId, sharesRevoked });
    return { sharesRevoked, authUserDeleted: false };
  }

  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    throw new PlatformError('STORAGE_ERROR', 'The account could not be deleted', {
      cause: error,
    });
  }

  logger.info('account.deleted', { userId, sharesRevoked });
  return { sharesRevoked, authUserDeleted: true };
}
