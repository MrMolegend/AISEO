import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSignalStore,
  resetMemorySignalStore,
  resetSignalStoreCache,
} from '@/lib/signals/store';
import {
  getLeadStore,
  resetMemoryLeadStore,
  resetLeadStoreCache,
} from '@/lib/leads/store';
import { resetMemoryCampaignStore, resetCampaignStoreCache } from '@/lib/campaigns/store';
import {
  getAltConfigStore,
  resetMemoryAltConfigStore,
  resetAltConfigStoreCache,
} from '@/lib/alt/config-store';
import { resetResearchProviderCache, FixtureResearchProvider } from '@/lib/research';
import { checkWatchlist, classifySignal, mentionsSubject } from '@/lib/signals/check';
import { normalizeAccountName } from '@/lib/leads/normalize';

/**
 * Watchlists on the fixture world: bounded checks, deduped signals, and
 * the honesty guard that keeps a page which never names the subject from
 * becoming a signal about it.
 */

const REP = '99999999-9999-4999-8999-999999999999';
const OTHER = '12121212-1212-4212-8212-121212121212';

beforeEach(() => {
  resetMemorySignalStore();
  resetSignalStoreCache();
  resetMemoryLeadStore();
  resetLeadStoreCache();
  resetMemoryCampaignStore();
  resetCampaignStoreCache();
  resetMemoryAltConfigStore();
  resetAltConfigStoreCache();
  resetResearchProviderCache();
  FixtureResearchProvider.reset();
});

async function seedAccountWatch() {
  const leads = await getLeadStore();
  const { account } = await leads.upsertAccount({
    campaignId: null,
    icpId: null,
    canonicalName: 'Pet Oasis',
    normalizedName: normalizeAccountName('Pet Oasis'),
    domain: null,
    websiteUrl: null,
    segmentKey: 'independent_pet_retail',
    territoryKey: 'AE-DU',
  });
  const store = await getSignalStore();
  const watchlist = await store.createWatchlist({
    ownerId: REP,
    name: 'Pet Oasis',
    kind: 'account',
    accountId: account.id,
    segmentKey: null,
    territoryKey: null,
  });
  return { account, watchlist, store };
}

describe('watchlist checks', () => {
  it('signals come only from results that name the subject, deduped by URL', async () => {
    const { watchlist, store, account } = await seedAccountWatch();

    const first = await checkWatchlist(watchlist.id, REP);
    // The fixture set has three results; one never names Pet Oasis.
    expect(first.added).toBe(2);
    expect(first.skipped).toBe(1);
    expect(first.duplicates).toBe(0);

    const again = await checkWatchlist(watchlist.id, REP);
    expect(again.added).toBe(0);
    expect(again.duplicates).toBe(2);

    const signals = await store.listSignals(watchlist.id);
    expect(signals).toHaveLength(2);
    expect(signals.every((signal) => signal.accountId === account.id)).toBe(true);
    expect(signals.every((signal) => signal.sourceHost.endsWith('.example'))).toBe(true);
  });

  it('a watch runs at most three checks a day', async () => {
    const { watchlist } = await seedAccountWatch();
    await checkWatchlist(watchlist.id, REP);
    await checkWatchlist(watchlist.id, REP);
    await checkWatchlist(watchlist.id, REP);
    await expect(checkWatchlist(watchlist.id, REP)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('checks spend from the shared daily research budget', async () => {
    const { watchlist } = await seedAccountWatch();
    const config = await getAltConfigStore();
    await config.setConfig('budget_caps', { perCampaignUnits: 100, perDayUnits: 2 }, REP);

    await checkWatchlist(watchlist.id, REP);
    await checkWatchlist(watchlist.id, REP);
    await expect(checkWatchlist(watchlist.id, REP)).rejects.toMatchObject({
      code: 'BUDGET_EXCEEDED',
    });
  });

  it("someone else's watch is a 404, not a denial", async () => {
    const { watchlist } = await seedAccountWatch();
    await expect(checkWatchlist(watchlist.id, OTHER)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('segment watches attach no account and still require the territory name', async () => {
    const store = await getSignalStore();
    const watchlist = await store.createWatchlist({
      ownerId: REP,
      name: 'Dubai independents',
      kind: 'segment',
      accountId: null,
      segmentKey: 'independent_pet_retail',
      territoryKey: 'AE-DU',
    });

    const outcome = await checkWatchlist(watchlist.id, REP);
    // The Riyadh result never says Dubai, so it is skipped.
    expect(outcome.added).toBe(1);
    expect(outcome.skipped).toBe(1);

    const signals = await store.listSignals(watchlist.id);
    expect(signals[0]!.accountId).toBeNull();
  });
});

describe('watchlist ownership and signal lifecycle', () => {
  it('deleting a watch is ownership-checked and removes its signals', async () => {
    const { watchlist, store } = await seedAccountWatch();
    await checkWatchlist(watchlist.id, REP);

    expect(await store.deleteWatchlist(watchlist.id, OTHER)).toBe(false);
    expect(await store.deleteWatchlist(watchlist.id, REP)).toBe(true);
    expect(await store.listSignals(watchlist.id)).toHaveLength(0);
  });

  it('dismissing removes a signal from the open feed but keeps the record', async () => {
    const { watchlist, store } = await seedAccountWatch();
    await checkWatchlist(watchlist.id, REP);

    const open = await store.openSignalsForOwner(REP);
    expect(open).toHaveLength(2);
    await store.dismissSignal(open[0]!.id);
    expect(await store.openSignalsForOwner(REP)).toHaveLength(1);
    expect(await store.listSignals(watchlist.id)).toHaveLength(2);
  });
});

describe('classification and the honesty guard, directly', () => {
  it('classifies from the page words, deterministically', () => {
    expect(classifySignal('Grand opening of a new store')).toBe('new_opening');
    expect(classifySignal('The chain is hiring sales staff')).toBe('hiring');
    expect(classifySignal('Quarterly results announced')).toBe('news_mention');
  });

  it('requires every subject word, not a vague resemblance', () => {
    const result = { title: 'Pet shop news', excerpt: 'A story about a pet shop.' };
    expect(mentionsSubject(result, ['pet', 'oasis'])).toBe(false);
    expect(
      mentionsSubject({ ...result, title: 'Pet Oasis news' }, ['pet', 'oasis']),
    ).toBe(true);
    expect(mentionsSubject(result, [])).toBe(false);
  });
});
