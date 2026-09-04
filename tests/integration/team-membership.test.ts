import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getTeamStore,
  resetMemoryTeamStore,
  resetTeamStoreCache,
} from '@/lib/team/store';
import {
  getAuditStore,
  resetMemoryAuditStore,
  resetAuditStoreCache,
} from '@/lib/audit/store';
import { memoryUserIdForEmail } from '@/lib/team/invite';
import type { AuthenticatedUser } from '@/lib/auth/server';

/**
 * The invitation-only door.
 *
 * These tests drive the real membership resolution — table row first,
 * revocation absolute, bootstrap claim only when no row exists — with the
 * identity layer mocked at its seam, which is exactly the seam production
 * uses (a verified JWT in, a user out).
 */

const currentUser = vi.hoisted(() => ({ value: null as AuthenticatedUser | null }));

vi.mock('@/lib/auth/server', () => ({
  getCurrentUser: async () => currentUser.value,
}));

const { getMembership, requireMember } = await import('@/lib/auth/membership');

function user(id: string, role: string | null = null): AuthenticatedUser {
  return { id, email: `${id.slice(0, 8)}@example.com`, role };
}

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  resetMemoryTeamStore();
  resetTeamStoreCache();
  resetMemoryAuditStore();
  resetAuditStoreCache();
  currentUser.value = null;
});

describe('membership resolution', () => {
  it('a signed-in account with no membership row and no claim is not a member', async () => {
    currentUser.value = user(ALICE);
    expect(await getMembership()).toBeNull();
  });

  it('an active row grants exactly the role on the row', async () => {
    const store = await getTeamStore();
    await store.upsert(
      { userId: ALICE, role: 'sales_rep', displayName: 'Alice', territories: ['Dubai'] },
      null,
    );
    currentUser.value = user(ALICE);

    const membership = await getMembership();
    expect(membership?.member.role).toBe('sales_rep');
    expect(membership?.member.territories).toEqual(['Dubai']);
    expect(membership?.bootstrap).toBe(false);
  });

  it('a role change on the row applies on the next request, no re-login involved', async () => {
    const store = await getTeamStore();
    await store.upsert(
      { userId: ALICE, role: 'sales_rep', displayName: 'Alice', territories: [] },
      null,
    );
    currentUser.value = user(ALICE);
    expect((await getMembership())?.member.role).toBe('sales_rep');

    await store.update(ALICE, { role: 'sales_manager' });
    expect((await getMembership())?.member.role).toBe('sales_manager');
  });

  it('revocation removes access immediately, and beats the bootstrap claim', async () => {
    const store = await getTeamStore();
    await store.upsert(
      { userId: ALICE, role: 'super_admin', displayName: 'Alice', territories: [] },
      null,
    );
    await store.update(ALICE, { status: 'revoked' });

    // Even carrying the admin claim, the explicit revocation wins.
    currentUser.value = user(ALICE, 'admin');
    expect(await getMembership()).toBeNull();
  });

  it('the legacy admin claim bootstraps super_admin when no row exists', async () => {
    currentUser.value = user(BOB, 'admin');
    const membership = await getMembership();
    expect(membership?.member.role).toBe('super_admin');
    expect(membership?.bootstrap).toBe(true);
  });

  it('requireMember enforces the allowed-role list with a 404, not a 403', async () => {
    const store = await getTeamStore();
    await store.upsert(
      { userId: ALICE, role: 'viewer', displayName: 'Alice', territories: [] },
      null,
    );
    currentUser.value = user(ALICE);

    await expect(requireMember('super_admin')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(requireMember('viewer', 'sales_rep')).resolves.toMatchObject({
      member: { role: 'viewer' },
    });
  });

  it('signed out is AUTH_REQUIRED, not NOT_FOUND', async () => {
    await expect(requireMember()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });
});

describe('the team store', () => {
  it('upsert reactivates a revoked member rather than duplicating them', async () => {
    const store = await getTeamStore();
    await store.upsert(
      { userId: ALICE, role: 'analyst', displayName: 'Alice', territories: [] },
      BOB,
    );
    await store.update(ALICE, { status: 'revoked' });
    await store.upsert(
      { userId: ALICE, role: 'viewer', displayName: 'Alice A.', territories: [] },
      BOB,
    );

    const members = await store.list();
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ role: 'viewer', status: 'active' });
    // The original inviter survives the reactivation.
    expect(members[0]!.invitedBy).toBe(BOB);
  });
});

describe('the audit trail', () => {
  it('appends and reads back by entity, newest first', async () => {
    const audit = await getAuditStore();
    await audit.append({
      actorId: ALICE,
      action: 'team.invite',
      entityKind: 'team_member',
      entityId: BOB,
    });
    await audit.append({
      actorId: ALICE,
      action: 'team.update',
      entityKind: 'team_member',
      entityId: BOB,
      metadata: { after: { role: 'viewer' } },
    });

    const events = await audit.forEntity('team_member', BOB);
    expect(events.map((event) => event.action)).toEqual(['team.update', 'team.invite']);
  });
});

describe('memory invitations', () => {
  it('derives a stable uuid-shaped id from an email, case-insensitively', () => {
    const a = memoryUserIdForEmail('Buyer@Example.com');
    const b = memoryUserIdForEmail('buyer@example.com');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
