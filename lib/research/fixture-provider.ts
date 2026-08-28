import { createHash } from 'node:crypto';
import { FIXTURE_RESULTS } from '@/fixtures/market-entry/search-results';
import { FIXTURE_PAGES } from '@/fixtures/market-entry/pages';
import { PlatformError } from '@/lib/errors';
import type { SafeFetchResult } from '@/lib/security/safe-fetch';
import type {
  ResearchProvider,
  SearchQuery,
  SearchResponse,
  SearchResult,
} from './provider';

/**
 * The deterministic provider that CI and local development run on.
 *
 * It replaces the old mock, which returned SHA-seeded nonsense on
 * `*.example.invalid` — fine for proving the plumbing moved bytes, useless for
 * proving anything about the product. Nothing downstream could be tested with
 * it: not the classifier, not retrieval, not the quality gate, not the report
 * renderer, because none of those have anything to say about a source called
 * "Result 3 for query 7".
 *
 * This one answers a real twelve-query plan with realistic sources for one
 * fictional market-entry case, so the whole pipeline runs end to end in CI with
 * no key, no cost and no network egress — and the resulting dossier is the one
 * the example page shows a visitor.
 *
 * `isLive` is false, which is what stops it anywhere near production: the
 * health endpoint reports the deployment unhealthy and the job pipeline refuses
 * to start a customer's report. See lib/env.ts `researchProvidersReady`.
 */
export class FixtureResearchProvider implements ResearchProvider {
  readonly name = 'fixture';
  readonly isLive = false;

  /** Every query this provider was asked, for tests that assert the plan. */
  static queries: SearchQuery[] = [];

  /**
   * Fault injection, for the tests that assert what happens when research
   * fails.
   *
   * Static because the pipeline resolves its own provider and there is nowhere
   * to inject an instance — the alternative was a constructor argument threaded
   * through four layers to be used by two tests.
   */
  static fault: 'unavailable' | 'rate-limited' | 'empty' | null = null;

  static reset(): void {
    FixtureResearchProvider.queries = [];
    FixtureResearchProvider.fault = null;
  }

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResponse> {
    FixtureResearchProvider.queries.push(query);

    if (signal.aborted) {
      throw new PlatformError('JOB_TIMEOUT', 'Cancelled before the search ran');
    }

    switch (FixtureResearchProvider.fault) {
      case 'unavailable':
        throw new PlatformError(
          'RESEARCH_PROVIDER_UNAVAILABLE',
          'Injected fault: provider unavailable',
        );
      case 'rate-limited':
        throw new PlatformError(
          'RESEARCH_PROVIDER_RATE_LIMITED',
          'Injected fault: provider rate limited',
        );
      case 'empty':
        return {
          query: query.query,
          results: [],
          usage: { credits: 0, latencyMs: 0 },
          provider: this.name,
        };
      default:
        break;
    }

    const area = query.area ?? '';
    const results =
      (FIXTURE_RESULTS as Record<string, SearchResult[] | undefined>)[area] ?? [];

    return {
      query: query.query,
      results: results.slice(0, query.maxResults),
      usage: {
        // Priced the way the provider prices it, so the observability record
        // means something even when the numbers are fictional.
        credits: query.depth === 'advanced' ? 2 : 1,
        latencyMs: 0,
      },
      provider: this.name,
    };
  }
}

/**
 * The page fetcher that pairs with it.
 *
 * Two of the fixture pages fail on purpose — one refuses by robots, one is
 * unreachable — so every fixture run exercises the best-effort retrieval path
 * rather than only the happy one. A fixture where every fetch succeeds lets
 * that code rot until the first time a customer loses a report to a slow
 * ministry website.
 */
export async function fixturePageFetcher(url: string): Promise<SafeFetchResult> {
  const page = FIXTURE_PAGES[url];

  if (!page) {
    throw new PlatformError('SITE_UNREACHABLE', `No fixture page for ${url}`);
  }
  if (page.kind === 'fail') {
    switch (page.reason) {
      case 'robots-disallowed':
        throw new PlatformError('ROBOTS_DISALLOWED', 'Fixture page refuses our agent');
      case 'blocked-by-site':
        throw new PlatformError('SITE_BLOCKED', 'Fixture page blocks automated access');
      default:
        throw new PlatformError('SITE_TIMEOUT', 'Fixture page did not respond');
    }
  }

  const bytes = Buffer.byteLength(page.body, 'utf8');
  return {
    finalUrl: url,
    status: 200,
    headers: { 'content-type': page.contentType },
    body: page.body,
    bytes,
    encodedBytes: bytes,
    encoding: 'identity',
    redirectChain: [],
    responseTimeMs: 0,
    truncated: false,
  };
}

/** Stable digest of the fixture set, so a changed fixture fails loudly. */
export function fixtureDigest(): string {
  return createHash('sha256')
    .update(JSON.stringify({ FIXTURE_RESULTS, FIXTURE_PAGES }))
    .digest('hex')
    .slice(0, 12);
}
