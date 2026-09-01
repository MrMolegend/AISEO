import 'server-only';
import { getCurrentUser, type AuthenticatedUser } from '@/lib/auth/server';
import { PlatformError } from '@/lib/errors';

/**
 * Admin authorisation.
 *
 * One rule: the verified session's `app_metadata.role` must be exactly
 * 'admin'. app_metadata is issued by the Auth server and writable only
 * through its admin API — a user cannot edit their own — which is the whole
 * difference between a role claim and an email string someone typed. Nothing
 * client-side participates in the decision, and there is no environment-
 * variable allowlist to drift out of date.
 *
 * Granting: from a privileged connection (never request-handling code),
 *   update auth.users
 *      set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
 *    where id = '<user uuid>';
 * The user signs out and in again to pick up the new claim.
 *
 * Failures are NOT_FOUND, not FORBIDDEN: an admin surface that answers
 * "forbidden" has confirmed it exists.
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new PlatformError('NOT_FOUND', 'No such page');
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'admin';
}
