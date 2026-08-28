import 'server-only';
import { RETRIEVAL_BUDGET } from '@/config/report';
import { PlatformError } from '@/lib/errors';
import { safeFetch, type SafeFetchResult } from '@/lib/security/safe-fetch';
import { checkRobots } from '@/lib/crawl/robots';
import { buildPageFacts, type PageFacts } from '@/lib/crawl/page-facts';
import { isCrawlable } from './policy';
import { publisherOf } from './classify';
import { logger } from '@/lib/observability/logger';
import type { blockedSourceSchema } from '@/schemas/market-entry/report';
import type { z } from 'zod';

export type BlockedSource = z.infer<typeof blockedSourceSchema>;

export interface RetrievedPage {
  url: string;
  facts: PageFacts;
  bytes: number;
}

export interface RetrievalOutcome {
  retrieved: RetrievedPage[];
  blocked: BlockedSource[];
  /** For the observability record. Never rendered to a customer. */
  stats: {
    attempted: number;
    succeeded: number;
    totalBytes: number;
    durationMs: number;
    stoppedBecause:
      'exhausted' | 'page-budget' | 'byte-budget' | 'time-budget' | 'aborted';
  };
}

/** Injectable so tests and fixtures never touch the network. */
export type PageFetcher = (url: string) => Promise<SafeFetchResult>;

/**
 * The two network operations retrieval performs, together.
 *
 * Bundled rather than passed separately because they must always be swapped as
 * a pair: a fixture page fetcher next to a real robots check would still make
 * twenty DNS lookups per test run, which is both slow and a way for CI to
 * acquire network egress by accident.
 */
export interface RetrievalTransport {
  fetchPage: PageFetcher;
  /** Returns false to refuse the fetch. Never throws to the caller. */
  robotsAllows: (url: string) => Promise<boolean>;
}

/**
 * Reads a handful of the sources we found, and gives up on any of them freely.
 *
 * This is the pass the previous pipeline claimed to do and did not: it wrote a
 * "reading the sources we found" stage with no work behind it, so every claim
 * in every report rested on a search engine's summary of a page nobody had
 * opened. The evidence rules make that insufficient for anything regulatory or
 * financial, which is why this exists.
 *
 * **It is enrichment, and it is never a dependency.** That is not a stylistic
 * preference, it is the contract:
 *
 *   · This function does not throw. Not for a robots refusal, not for a
 *     timeout, not for a CAPTCHA, not if every single fetch fails. It returns
 *     what it got and a list of what it could not have.
 *   · A blocked page becomes a recorded limitation the report shows, not an
 *     error the customer sees. An authority's website being slow on a Tuesday
 *     is not a reason to fail a report someone paid for.
 *   · The caller is written so that an empty `retrieved` array is an ordinary
 *     outcome. Claims that needed a directly-read source are demoted to
 *     unverified by the validator; the report still ships.
 *
 * Everything it does fetch goes through the same guarded path as before —
 * SSRF-checked, redirect-validated, byte-capped, robots-respected — and
 * platforms whose terms forbid automated access are never requested at all.
 */
export async function retrieveSources(
  urls: readonly string[],
  signal: AbortSignal,
  options: { transport?: RetrievalTransport; budget?: typeof RETRIEVAL_BUDGET } = {},
): Promise<RetrievalOutcome> {
  const budget = options.budget ?? RETRIEVAL_BUDGET;
  const transport = options.transport ?? liveTransport;
  const { fetchPage, robotsAllows } = transport;
  const started = Date.now();

  const retrieved: RetrievedPage[] = [];
  const blocked: BlockedSource[] = [];
  const perPublisher = new Map<string, number>();

  let attempted = 0;
  let totalBytes = 0;
  let stoppedBecause: RetrievalOutcome['stats']['stoppedBecause'] = 'exhausted';

  const record = (url: string, reason: BlockedSource['reason']): void => {
    blocked.push({ url, publisher: publisherOf(url), reason });
  };

  for (const url of urls) {
    if (signal.aborted) {
      stoppedBecause = 'aborted';
      break;
    }
    /*
     * Attempts, not successes.
     *
     * A failed fetch costs a request, a DNS lookup and up to the whole
     * connect timeout, so budgeting successes would let a run of dead hosts
     * consume far more than the budget was meant to allow — and the worse the
     * sources, the longer the customer waits.
     */
    if (attempted >= budget.maxFetches) {
      stoppedBecause = 'page-budget';
      break;
    }
    if (totalBytes >= budget.maxTotalBytes) {
      stoppedBecause = 'byte-budget';
      break;
    }
    if (Date.now() - started >= budget.maxDurationMs) {
      stoppedBecause = 'time-budget';
      break;
    }

    // Platform terms, checked before anything is requested. We do not fetch
    // these hosts, do not pretend to be a browser, and do not route around a
    // block — the index entry is still citable, it is simply never opened.
    if (!isCrawlable(url)) {
      record(url, 'platform-policy');
      continue;
    }

    const publisher = publisherOf(url) ?? url;
    const already = perPublisher.get(publisher) ?? 0;
    if (already >= budget.maxPerPublisher) continue;

    attempted += 1;

    if (!(await robotsAllows(url))) {
      record(url, 'robots-disallowed');
      continue;
    }

    try {
      const response = await fetchPage(url);
      totalBytes += response.bytes;
      perPublisher.set(publisher, already + 1);

      retrieved.push({
        url: response.finalUrl,
        bytes: response.bytes,
        facts: buildPageFacts({
          url: response.finalUrl,
          html: response.body,
          httpStatus: response.status,
          bytes: response.bytes,
        }),
      });
    } catch (error) {
      record(url, reasonFor(error));
      logger.debug('retrieve.page_skipped', { url, error: String(error) });
    }
  }

  return {
    retrieved,
    blocked,
    stats: {
      attempted,
      succeeded: retrieved.length,
      totalBytes,
      durationMs: Date.now() - started,
      stoppedBecause,
    },
  };
}

/**
 * The real transport.
 *
 * A robots.txt we could not read is not a refusal: the standard's own default
 * is "allowed", and treating an unreachable robots file as a ban would make
 * every briefly-flaky host permanently unreadable.
 */
export const liveTransport: RetrievalTransport = {
  fetchPage: safeFetch,
  async robotsAllows(url) {
    try {
      const robots = await checkRobots(url);
      return robots.allowsOurAgent;
    } catch (error) {
      logger.debug('retrieve.robots_unreadable', { url, error: String(error) });
      return true;
    }
  },
};

/**
 * Maps a failure onto something a reader can understand.
 *
 * The reasons are deliberately coarse. A customer reading the coverage panel
 * needs to know whether a source refused us, was unreachable, or gave us
 * something we could not read — not which of eleven internal error codes fired.
 */
function reasonFor(error: unknown): BlockedSource['reason'] {
  if (error instanceof PlatformError) {
    switch (error.code) {
      case 'ROBOTS_DISALLOWED':
        return 'robots-disallowed';
      case 'SITE_BLOCKED':
        return 'blocked-by-site';
      case 'SITE_TIMEOUT':
        return 'timeout';
      case 'SITE_TOO_LARGE':
        return 'too-large';
      case 'NOT_HTML':
      case 'UNSUPPORTED_CONTENT':
      case 'RESPONSE_DECODE_FAILED':
      case 'NO_CONTENT':
        return 'not-readable';
      default:
        return 'unreachable';
    }
  }
  return 'unreachable';
}

/**
 * Chooses which of the discovered URLs are worth spending the budget on.
 *
 * Authority first, because those are the sources that can carry a regulatory or
 * market-size claim and an indexed snippet cannot. Then one page per publisher
 * before any second page, so eight fetches reach eight organisations rather
 * than one site's sitemap.
 */
export function prioritiseForRetrieval(
  candidates: readonly { url: string; category: string; score: number }[],
  limit: number,
): string[] {
  const AUTHORITY_ORDER = [
    'official',
    'regulator',
    'customs',
    'statistical',
    'trade_association',
    'chamber',
    'industry_publication',
    'retailer',
    'news',
    'company',
    'directory',
    'other',
  ];

  const ranked = [...candidates].sort((a, b) => {
    const byAuthority =
      AUTHORITY_ORDER.indexOf(a.category) - AUTHORITY_ORDER.indexOf(b.category);
    if (byAuthority !== 0) return byAuthority;
    return b.score - a.score;
  });

  const firstPass: string[] = [];
  const secondPass: string[] = [];
  const seen = new Set<string>();

  for (const candidate of ranked) {
    const publisher = publisherOf(candidate.url) ?? candidate.url;
    if (seen.has(publisher)) secondPass.push(candidate.url);
    else {
      seen.add(publisher);
      firstPass.push(candidate.url);
    }
  }

  return [...firstPass, ...secondPass].slice(0, limit);
}
