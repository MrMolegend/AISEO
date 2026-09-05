import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getMembership, type Membership } from '@/lib/auth/membership';
import type { AltRole } from '@/schemas/team';

/**
 * The page-level gate.
 *
 * Route handlers throw typed errors; pages navigate. This helper gives every
 * workspace page the same three-step door:
 *
 *   signed out            → sign-in, returning here afterwards
 *   signed in, no member  → the request-access holding page
 *   member, wrong role    → 404, the same one a mistyped URL earns
 *
 * It returns the membership so pages don't resolve it twice.
 */
export async function requireWorkspacePage(
  returnTo: string,
  ...allowed: readonly AltRole[]
): Promise<Membership> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(returnTo));

  const membership = await getMembership();
  if (!membership) redirect('/request-access');

  if (allowed.length > 0 && !allowed.includes(membership.member.role)) {
    notFound();
  }
  return membership;
}
