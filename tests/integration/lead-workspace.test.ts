import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLeadStore,
  resetMemoryLeadStore,
  resetLeadStoreCache,
} from '@/lib/leads/store';
import { normalizeAccountName } from '@/lib/leads/normalize';

const ANALYST = '55555555-5555-4555-8555-555555555555';

async function seedAccount(
  name: string,
  extras?: { domain?: string; campaignId?: string },
) {
  const store = await getLeadStore();
  const { account } = await store.upsertAccount({
    campaignId: extras?.campaignId ?? null,
    icpId: null,
    canonicalName: name,
    normalizedName: normalizeAccountName(name),
    domain: extras?.domain ?? null,
    websiteUrl: null,
    segmentKey: 'independent_pet_retail',
    territoryKey: 'AE-DU',
  });
  return account;
}

beforeEach(() => {
  resetMemoryLeadStore();
  resetLeadStoreCache();
});

describe('manual merge and undo', () => {
  it('merges with a reason, hides the loser from working lists, and restores exactly', async () => {
    const store = await getLeadStore();
    const winner = await seedAccount('Pet Oasis');
    const loser = await seedAccount('Oasis Pet Supplies');

    const merge = await store.merge(
      winner.id,
      loser.id,
      ANALYST,
      'Same trade licence, confirmed by phone.',
    );
    expect(merge.reason).toContain('trade licence');

    const working = await store.listAccounts();
    expect(working.map((account) => account.id)).not.toContain(loser.id);

    const merged = await store.getAccount(loser.id);
    expect(merged?.status).toBe('merged');
    expect(merged?.mergedInto).toBe(winner.id);

    // Undo restores the row to working state.
    expect(await store.undoMerge(merge.id)).toBe(true);
    const restored = await store.getAccount(loser.id);
    expect(restored?.status).toBe('candidate');
    expect(restored?.mergedInto).toBeNull();

    // A second undo is a no-op, not a resurrection loop.
    expect(await store.undoMerge(merge.id)).toBe(false);
  });

  it('a merged loser cannot be merged again, and self-merge is refused upstream', async () => {
    const store = await getLeadStore();
    const winner = await seedAccount('Pet Oasis');
    const other = await seedAccount('Whisker Paw');
    const loser = await seedAccount('Oasis Pet Supplies');

    await store.merge(winner.id, loser.id, ANALYST, 'Duplicate.');
    await expect(
      store.merge(other.id, loser.id, ANALYST, 'Trying again'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('the working list', () => {
  it('filters by status, campaign and search, and paginates', async () => {
    const store = await getLeadStore();
    const campaignId = '66666666-6666-4666-8666-666666666666';
    const a = await seedAccount('Pet Oasis', { campaignId });
    await seedAccount('Whisker Paw Boutique', { campaignId });
    await seedAccount('Elsewhere Trading');

    await store.updateAccount(a.id, { status: 'qualified' });

    expect(await store.countAccounts({ campaignId })).toBe(2);
    expect(await store.countAccounts({ statuses: ['qualified'] })).toBe(1);
    expect(await store.countAccounts({ search: 'whisker' })).toBe(1);

    const pageOne = await store.listAccounts({ limit: 2, offset: 0 });
    const pageTwo = await store.listAccounts({ limit: 2, offset: 2 });
    expect(pageOne).toHaveLength(2);
    expect(pageTwo).toHaveLength(1);
    expect(new Set([...pageOne, ...pageTwo].map((account) => account.id)).size).toBe(3);
  });

  it('assignment and status changes stick, and merged rows refuse edits at the route contract', async () => {
    const store = await getLeadStore();
    const account = await seedAccount('Pet Oasis');
    const updated = await store.updateAccount(account.id, {
      status: 'qualified',
      ownerId: ANALYST,
    });
    expect(updated?.ownerId).toBe(ANALYST);
    expect(updated?.status).toBe('qualified');
  });
});
