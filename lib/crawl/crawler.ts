import 'server-only';
import { safeFetch } from '@/lib/security/safe-fetch';
import { checkRobots } from './robots';
import { PlatformError, toPlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';
import { isCrawlable } from '@/lib/research/policy';
import { UrlFrontier, normalizeUrl } from './url-frontier';
import { parseSitemap, defaultSitemapUrls, MAX_SITEMAP_DEPTH } from './sitemap';
import { buildPageFacts, type PageFacts } from './page-facts';
import type { SourceRegistry } from './source-registry';

/**
 * Bounded same-site crawler.
 *
 * Reading only a company's homepage tells you what it wants to be known for.
 * Reading its pricing, services, about and case-study pages tells you what it
 * actually sells and to whom — which is what a research report needs.
 *
 * Every dimension is bounded, because the target is chosen by a stranger and
 * an unbounded crawl of a hostile site is a denial-of-service against
 * ourselves: pages, bytes per page, bytes in total, wall-clock time,
 * concurrency and redirects. The budget is spent in priority order, so running
 * out means missing a blog post rather than missing the pricing page.
 *
 * Every fetch goes through safeFetch, which keeps the SSRF guard, the
 * connect-time address check, per-hop redirect validation and the decoding
 * ceilings. The crawler adds no network path of its own — there is exactly one
 * way out of this process and it is guarded.
 */

export interface CrawlBudget {
  maxPages: number;
  maxTotalBytes: number;
  maxDurationMs: number;
  /** Parallel fetches. Kept low: this is someone else's server. */
  concurrency: number;
}

export const DEFAULT_CRAWL_BUDGET: CrawlBudget = {
  maxPages: 25,
  maxTotalBytes: 12 * 1024 * 1024,
  maxDurationMs: 90_000,
  concurrency: 3,
};

export interface CrawlOutcome {
  /** Pages successfully read, in the order they were fetched. */
  pages: Array<{ facts: PageFacts; sourceRef: string }>;
  startUrl: string;
  finalUrl: string;
  hostname: string;
  stats: {
    fetched: number;
    failed: number;
    discovered: number;
    totalBytes: number;
    durationMs: number;
    /** Why the crawl stopped, for the report's limitations section. */
    stoppedBecause: 'exhausted' | 'page-budget' | 'byte-budget' | 'time-budget';
  };
  /** Honest notes for the report, rather than silent gaps. */
  notes: string[];
}

export async function crawlSite(
  startUrl: string,
  registry: SourceRegistry,
  budget: CrawlBudget,
  signal: AbortSignal,
): Promise<CrawlOutcome> {
  const started = Date.now();
  const notes: string[] = [];

  const seed = normalizeUrl(startUrl);
  if (!seed) {
    throw new PlatformError('INVALID_URL', 'The website address could not be parsed');
  }

  if (!isCrawlable(seed.url)) {
    throw new PlatformError(
      'BLOCKED_URL',
      'That address is on a platform whose terms forbid automated access',
    );
  }

  // robots.txt first, always. One request, and it decides whether the rest
  // happens at all.
  const robots = await checkRobots(seed.url).catch((error) => {
    // A robots.txt we could not fetch is not permission to ignore it, but it is
    // also not evidence of refusal. Proceed and say so.
    logger.warn('crawl.robots_unavailable', { error: String(error) });
    notes.push('robots.txt could not be read, so default crawling rules were assumed.');
    return { found: false, allowsOurAgent: true, sitemapUrls: [] as string[] };
  });

  if (!robots.allowsOurAgent) {
    throw new PlatformError(
      'ROBOTS_DISALLOWED',
      'robots.txt asks automated tools not to read this site',
      { context: { url: seed.url } },
    );
  }

  const frontier = new UrlFrontier(seed.hostname);
  frontier.add(seed.url, 'seed');

  const origin = new URL(seed.url).origin;
  const sitemapCandidates = robots.sitemapUrls.length
    ? robots.sitemapUrls.slice(0, 3)
    : defaultSitemapUrls(origin);

  const fromSitemap = await collectSitemapUrls(sitemapCandidates, signal);
  let queuedFromSitemap = 0;
  for (const url of fromSitemap) {
    if (frontier.add(url, 'sitemap', seed.url)) queuedFromSitemap += 1;
  }
  if (queuedFromSitemap > 0) {
    registry.register({
      url: sitemapCandidates[0]!,
      type: 'sitemap',
      title: 'XML sitemap',
      fetched: true,
    });
  }

  const pages: CrawlOutcome['pages'] = [];
  let totalBytes = 0;
  let failed = 0;
  let finalUrl = seed.url;
  /**
   * Held in an object rather than a bare `let` so that TypeScript does not
   * narrow it to its initial value: several workers write it, and a narrowed
   * type would make the later comparisons look impossible.
   *
   * First reason wins — whichever budget a worker hit first is the one that
   * actually stopped the crawl; later workers hitting others is noise.
   */
  const stop = { reason: 'exhausted' as CrawlOutcome['stats']['stoppedBecause'] };
  const setStopReason = (reason: CrawlOutcome['stats']['stoppedBecause']) => {
    if (stop.reason === 'exhausted') stop.reason = reason;
  };

  const deadline = started + budget.maxDurationMs;

  /**
   * One worker. Several run concurrently, each taking from the shared frontier,
   * which is what keeps a slow page from stalling the whole crawl while still
   * respecting the priority ordering.
   */
  async function worker(): Promise<void> {
    for (;;) {
      if (signal.aborted) return;
      if (pages.length >= budget.maxPages) {
        setStopReason('page-budget');
        return;
      }
      if (totalBytes >= budget.maxTotalBytes) {
        setStopReason('byte-budget');
        return;
      }
      if (Date.now() > deadline) {
        setStopReason('time-budget');
        return;
      }

      const next = frontier.take();
      if (!next) return;

      try {
        const response = await safeFetch(next.url);
        finalUrl = pages.length === 0 ? response.finalUrl : finalUrl;
        totalBytes += response.bytes;

        const facts = buildPageFacts({
          url: response.finalUrl,
          html: response.body,
          httpStatus: response.status,
          bytes: response.bytes,
        });

        const source = registry.register({
          url: response.finalUrl,
          title: facts.title,
          type: 'web_page',
          httpStatus: response.status,
          excerpt: facts.metaDescription ?? facts.text.slice(0, 400),
          content: response.body,
          fetched: true,
        });

        // A full registry means the job has all the citable material it is
        // going to get. Keep the page — it is already paid for — but stop
        // discovering more.
        if (source) {
          pages.push({ facts, sourceRef: source.ref });
        }

        // Only the seed page's links are followed broadly; deeper pages
        // contribute their links too, but the priority ordering decides what
        // actually gets fetched.
        for (const href of facts.internalLinks) {
          frontier.add(href, 'link', response.finalUrl);
        }
      } catch (error) {
        failed += 1;
        const platform = toPlatformError(error);

        // The seed page failing is fatal — there is no site to research.
        // A secondary page failing is a gap, not a failure.
        if (pages.length === 0 && next.discoveredVia === 'seed') {
          throw platform;
        }
        logger.debug('crawl.page_failed', { url: next.url, code: platform.code });
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, budget.concurrency) }, () => worker());
  await Promise.all(workers);

  if (signal.aborted) {
    throw new PlatformError('CRAWL_TIMEOUT', 'The crawl was cancelled by its budget');
  }

  if (pages.length === 0) {
    throw new PlatformError('NO_CONTENT', 'No readable pages were found on the site');
  }

  // Honest notes rather than silent gaps.
  if (stop.reason === 'page-budget') {
    notes.push(
      `Reading stopped at ${budget.maxPages} pages; ${frontier.pending} more were known but not read.`,
    );
  } else if (stop.reason === 'time-budget') {
    notes.push('Reading stopped at the time limit, so some pages were not read.');
  } else if (stop.reason === 'byte-budget') {
    notes.push('Reading stopped at the data limit, so some pages were not read.');
  }

  const shells = pages.filter((p) => p.facts.likelyClientRendered).length;
  if (shells > 0 && shells >= pages.length / 2) {
    notes.push(
      'Most pages returned very little text and appear to render in the browser, so what could be read about this site is limited.',
    );
  }

  return {
    pages,
    startUrl: seed.url,
    finalUrl,
    hostname: seed.hostname,
    stats: {
      fetched: pages.length,
      failed,
      discovered: frontier.discovered,
      totalBytes,
      durationMs: Date.now() - started,
      stoppedBecause: stop.reason,
    },
    notes,
  };
}

/**
 * Reads sitemaps, following index documents one level.
 *
 * Failures are silent by design: a missing sitemap is the normal case, not an
 * error, and the crawl proceeds on link discovery alone.
 */
async function collectSitemapUrls(
  candidates: string[],
  signal: AbortSignal,
  depth = 0,
): Promise<string[]> {
  if (depth >= MAX_SITEMAP_DEPTH || signal.aborted) return [];

  const collected: string[] = [];

  for (const candidate of candidates.slice(0, 3)) {
    if (signal.aborted) break;
    try {
      const response = await safeFetch(candidate);
      const parsed = parseSitemap(response.body);

      collected.push(...parsed.urls);

      if (parsed.sitemaps.length > 0) {
        collected.push(
          ...(await collectSitemapUrls(parsed.sitemaps.slice(0, 2), signal, depth + 1)),
        );
      }
    } catch {
      // No sitemap at this address. Entirely normal.
    }
  }

  return collected;
}
