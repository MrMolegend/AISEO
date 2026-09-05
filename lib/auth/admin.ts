import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth/server';
import { getMembership, requireMember } from '@/lib/auth/membership';

/**
 * Admin authorisation — now a thin veneer over the membership model.
 *
 * "Admin" means the super_admin role: either an active team_members row
 * carrying it, or the server-issued bootstrap claim
 * (`app_metadata.role = 'admin'`) that exists so the first membership rows
 * can be created at all. See lib/auth/membership.ts for the resolution
 * order and why the table, not the JWT, is authoritative.
 *
 * Granting the bootstrap claim, from a privileged connection (never
 * request-handling code):
 *   update auth.users
 *      set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
 *    where id = '<user uuid>';
 *
 * Failures are NOT_FOUND, not FORBIDDEN: an admin surface that answers
 * "forbidden" has confirmed it exists.
 */
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const { user } = await requireMember('super_admin');
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const membership = await getMembership();
  return membership?.member.role === 'super_admin';
}
