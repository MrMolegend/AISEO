import 'server-only';
import { getCurrentUser, type AuthenticatedUser } from '@/lib/auth/server';
import { getTeamStore, type TeamMemberRecord } from '@/lib/team/store';
import { getAuditStore } from '@/lib/audit/store';
import { logger } from '@/lib/observability/logger';
import { PlatformError } from '@/lib/errors';
import { ALT_ROLES, type AltRole } from '@/schemas/team';

/**
 * Membership-based authorisation for the workspace.
 *
 * Rules, in order:
 *
 *   1. The identity comes from the verified session — lib/auth/server.ts.
 *   2. The role comes from the team_members table, read on this request.
 *      A change there is effective immediately; there is no stale-JWT
 *      window because the JWT was never the source of the role.
 *   3. A row with status 'revoked' denies everything, including holders of
 *      the bootstrap claim: explicit revocation always wins.
 *   4. With no row at all, the JWT's app_metadata.role is honoured as
 *      BOOTSTRAP only: 'admin' or 'super_admin' acts as super_admin so the
 *      first real membership rows can be created. The grant lives in
 *      auth.users.raw_app_meta_data, writable only through the Auth admin
 *      API — never by the user. (Under the e2e test driver, the session's
 *      role knob flows through the same path with any role, so browser
 *      tests can exercise each role without a database.)
 *
 * Denials are NOT_FOUND, not FORBIDDEN, everywhere: an internal tool that
 * answers "forbidden" has confirmed to a non-member that the page exists.
 */

export interface Membership {
  user: AuthenticatedUser;
  member: TeamMemberRecord;
  /** True when the role came from the bootstrap claim, not a table row. */
  bootstrap: boolean;
}

function claimRole(user: AuthenticatedUser): AltRole | null {
  if (user.role === 'admin') return 'super_admin';
  if (user.role && (ALT_ROLES as readonly string[]).includes(user.role)) {
    return user.role as AltRole;
  }
  return null;
}

function virtualMember(user: AuthenticatedUser, role: AltRole): TeamMemberRecord {
  const now = new Date().toISOString();
  return {
    userId: user.id,
    role,
    displayName: user.email ?? 'Bootstrap administrator',
    territories: [],
    status: 'active',
    invitedBy: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** The current member, or null. Never throws for a mere non-member. */
export async function getMembership(): Promise<Membership | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const store = await getTeamStore();
  const member = await store.get(user.id);

  if (member) {
    if (member.status !== 'active') return null;
    return { user, member, bootstrap: false };
  }

  const bootstrap = claimRole(user);
  if (bootstrap) {
    return { user, member: virtualMember(user, bootstrap), bootstrap: true };
  }
  return null;
}

/**
 * The current member, required — optionally with an allowed-role list.
 *
 * With no roles given, any active member passes. AUTH_REQUIRED when nobody
 * is signed in (pages redirect to sign-in); NOT_FOUND when signed in but not
 * an authorised member for this surface.
 */
export async function requireMember(...allowed: readonly AltRole[]): Promise<Membership> {
  const user = await getCurrentUser();
  if (!user) {
    throw new PlatformError('AUTH_REQUIRED', 'No authenticated user on this request');
  }

  const membership = await getMembership();
  if (!membership) {
    throw new PlatformError('NOT_FOUND', 'No such page');
  }
  if (allowed.length > 0 && !allowed.includes(membership.member.role)) {
    throw new PlatformError('NOT_FOUND', 'No such page');
  }
  return membership;
}

/**
 * Best-effort audit write. The user's action must not fail because an audit
 * row could not be written — but a failed write is still logged, because a
 * silently incomplete audit trail is worse than a noisy one.
 */
export async function recordAudit(
  actorId: string | null,
  action: string,
  entityKind: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const store = await getAuditStore();
    await store.append({ actorId, action, entityKind, entityId, metadata });
  } catch (cause) {
    logger.error('audit.append_failed', {
      action,
      entityKind,
      error: cause instanceof Error ? cause.message : 'unknown',
    });
  }
}
