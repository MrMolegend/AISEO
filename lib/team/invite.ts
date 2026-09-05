import 'server-only';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getTeamStore, type TeamMemberRecord } from '@/lib/team/store';
import { recordAudit } from '@/lib/auth/membership';
import { getEnv, hasSupabase } from '@/lib/env';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';
import type { AltRole } from '@/schemas/team';

/**
 * Inviting a member by email.
 *
 * The invitation is a membership row, not a special email: once the row
 * exists, the person signs in through the ordinary flow with the same
 * address and lands in the workspace. If they have no auth account yet, one
 * is created for the address through the Auth admin API — unconfirmed, so
 * the normal email verification still happens on their first sign-in.
 *
 * Without Supabase (dev, tests) there is no auth directory to consult, so
 * the member id is derived deterministically from the email. The e2e driver
 * derives the same id to sign in as the invited person.
 */

export interface InviteInput {
  email: string;
  role: AltRole;
  displayName: string;
  territories: string[];
}

/** Deterministic uuid-shaped id for memory mode. Not used with Supabase. */
export function memoryUserIdForEmail(email: string): string {
  const hex = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

async function resolveUserId(email: string): Promise<string> {
  const env = getEnv();
  if (!hasSupabase(env)) return memoryUserIdForEmail(email);

  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // createUser fails when the address already exists; that failure is the
  // lookup. The admin listUsers API pages by 50 and has no email filter in
  // this SDK version, so create-then-fallback is the honest two-step.
  const created = await admin.auth.admin.createUser({ email, email_confirm: false });
  if (created.data.user) return created.data.user.id;

  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listed.data.users?.find(
    (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
  );
  if (existing) return existing.id;

  throw new PlatformError('STORAGE_ERROR', 'Could not resolve the invited account', {
    cause: created.error ?? listed.error ?? undefined,
  });
}

export async function inviteMember(
  input: InviteInput,
  invitedBy: string,
): Promise<TeamMemberRecord> {
  const userId = await resolveUserId(input.email);
  const store = await getTeamStore();
  const member = await store.upsert(
    {
      userId,
      role: input.role,
      displayName: input.displayName,
      territories: input.territories,
    },
    invitedBy,
  );

  logger.info('team.member_invited', { userId, role: input.role });
  await recordAudit(invitedBy, 'team.invite', 'team_member', userId, {
    role: input.role,
    displayName: input.displayName,
  });
  return member;
}
