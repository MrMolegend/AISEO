import 'server-only';
import { getSignalStore, type WatchlistRecord } from '@/lib/signals/store';
import { getLeadStore } from '@/lib/leads/store';
import { getCampaignStore } from '@/lib/campaigns/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { getResearchProvider } from '@/lib/research';
import type { SearchResult } from '@/lib/research/provider';
import { normalizeAccountName } from '@/lib/leads/normalize';
import { MAX_CHECKS_PER_WATCHLIST_PER_DAY, type SignalKind } from '@/schemas/signals';
import { SEGMENT_LABEL, type SegmentKey } from '@/config/alt';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

/**
 * Checking a watchlist: one bounded, budgeted provider search.
 *
 * Two caps gate every check server-side. The watchlist itself may run at
 * most a few checks a day, and each check costs one research unit against
 * the same workspace daily cap campaign discovery spends from — signals
 * never become an unmetered side channel for search spend. The check is
 * recorded before the search runs, the same decrement-before-spend order
 * the discovery engine uses.
 *
 * The honesty guard: a search result becomes a signal only when its own
 * words reference the watched subject. For an account watch every word of
 * the normalised account name must appear in the result's title or
 * excerpt; for a segment watch the territory's name must. Anything else is
 * skipped — a page that does not mention the subject is not evidence
 * about it, however well it ranked.
 */

const RESULTS_PER_CHECK = 8;

export interface CheckOutcome {
  added: number;
  duplicates: number;
  skipped: number;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfTodayUtc(): string {
  return `${todayUtc()}T00:00:00.000Z`;
}

/** Deterministic keyword classification from the page's own words. */
export function classifySignal(text: string): SignalKind {
  const lowered = text.toLowerCase();
  if (
    /\b(now open|grand opening|opens|opening|new (store|branch|location|outlet))\b/.test(
      lowered,
    )
  ) {
    return 'new_opening';
  }
  if (/\b(expand|expansion|second branch|new market|entering)\b/.test(lowered)) {
    return 'expansion';
  }
  if (/\b(hiring|careers|vacanc|recruit|join our team)\b/.test(lowered)) {
    return 'hiring';
  }
  if (/\b(now stock|new range|assortment|new brands?|product line)\b/.test(lowered)) {
    return 'assortment_change';
  }
  return 'news_mention';
}

/** True when the result's own words reference the watched subject. */
export function mentionsSubject(
  result: Pick<SearchResult, 'title' | 'excerpt'>,
  requiredWords: string[],
): boolean {
  const haystack = `${result.title} ${result.excerpt}`.toLowerCase();
  return (
    requiredWords.length > 0 && requiredWords.every((word) => haystack.includes(word))
  );
}

async function subjectFor(watchlist: WatchlistRecord): Promise<{
  query: string;
  area: string;
  requiredWords: string[];
  accountId: string | null;
}> {
  if (watchlist.kind === 'account') {
    const leads = await getLeadStore();
    const account = watchlist.accountId
      ? await leads.getAccount(watchlist.accountId)
      : null;
    if (!account)
      throw new PlatformError('NOT_FOUND', 'The watched account no longer exists');
    const normalized = normalizeAccountName(account.canonicalName);
    return {
      query: `"${account.canonicalName}" news opening expansion`,
      area: `discovery:signals:${normalized}`,
      requiredWords: normalized.split(' ').filter((word) => word.length > 1),
      accountId: account.id,
    };
  }
  const config = await getAltConfigStore();
  const territories = await config.listTerritories();
  const territory = territories.find((entry) => entry.key === watchlist.territoryKey);
  if (!territory)
    throw new PlatformError('NOT_FOUND', 'The watched territory no longer exists');
  const segmentLabel =
    SEGMENT_LABEL[watchlist.segmentKey as SegmentKey] ?? watchlist.segmentKey ?? '';
  return {
    query: `${segmentLabel} ${territory.name} new opening expansion`,
    area: `discovery:signals:${watchlist.segmentKey}:${watchlist.territoryKey}`,
    requiredWords: [territory.name.toLowerCase()],
    accountId: null,
  };
}

export async function checkWatchlist(
  watchlistId: string,
  ownerId: string,
): Promise<CheckOutcome> {
  const store = await getSignalStore();
  const watchlist = await store.getWatchlist(watchlistId);
  if (!watchlist || !watchlist.active || watchlist.ownerId !== ownerId) {
    throw new PlatformError('NOT_FOUND', 'No such watch');
  }

  const day = todayUtc();
  if (
    watchlist.lastCheckedOn === day &&
    watchlist.checksToday >= MAX_CHECKS_PER_WATCHLIST_PER_DAY
  ) {
    throw new PlatformError(
      'RATE_LIMITED',
      `This watch has already been checked ${MAX_CHECKS_PER_WATCHLIST_PER_DAY} times today.`,
    );
  }

  const [config, campaigns] = await Promise.all([
    getAltConfigStore(),
    getCampaignStore(),
  ]);
  const [caps, campaignUnitsToday, checkUnitsToday] = await Promise.all([
    config.getConfig('budget_caps'),
    campaigns.unitsSpentSince(startOfTodayUtc()),
    store.checksUsedOn(day),
  ]);
  if (campaignUnitsToday + checkUnitsToday + 1 > caps.perDayUnits) {
    throw new PlatformError(
      'BUDGET_EXCEEDED',
      `Today's research has already used ${campaignUnitsToday + checkUnitsToday} of ${caps.perDayUnits} units; this check will not fit.`,
    );
  }

  const subject = await subjectFor(watchlist);

  // Recorded before the search runs: the unit is spent even if the search
  // returns nothing, so a failing provider cannot mint free retries.
  await store.recordCheck(watchlist.id, day);

  const provider = await getResearchProvider();
  const response = await provider.search(
    {
      query: subject.query,
      maxResults: RESULTS_PER_CHECK,
      area: subject.area,
    },
    AbortSignal.timeout(30_000),
  );

  let added = 0;
  let duplicates = 0;
  let skipped = 0;
  for (const result of response.results) {
    if (!mentionsSubject(result, subject.requiredWords)) {
      skipped += 1;
      continue;
    }
    let sourceHost: string;
    try {
      sourceHost = new URL(result.url).hostname;
    } catch {
      skipped += 1;
      continue;
    }
    const { existed } = await store.addSignal({
      watchlistId: watchlist.id,
      accountId: subject.accountId,
      kind: classifySignal(`${result.title} ${result.excerpt}`),
      title: result.title.slice(0, 500),
      url: result.url,
      sourceHost,
      excerpt: result.excerpt ? result.excerpt.slice(0, 2000) : null,
    });
    if (existed) duplicates += 1;
    else added += 1;
  }

  logger.info('signals.check_completed', {
    watchlistId: watchlist.id,
    added,
    duplicates,
    skipped,
  });
  return { added, duplicates, skipped };
}
