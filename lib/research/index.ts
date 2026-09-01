import 'server-only';
import { getEnv, hasRealResearchProvider } from '@/lib/env';
import { FixtureResearchProvider, fixturePageFetcher } from './fixture-provider';
import type { ResearchProvider } from './provider';
import type { RetrievalTransport } from './retrieve';
import { liveTransport } from './retrieve';

export type {
  ResearchProvider,
  SearchQuery,
  SearchResult,
  SearchResponse,
} from './provider';
export { MAX_RESULTS_PER_QUERY, NON_CRAWLABLE_HOSTS } from './provider';
export { FixtureResearchProvider, fixtureRetrieval } from './fixture-provider';

let cached: ResearchProvider | null = null;

/**
 * Resolves the research provider.
 *
 * Falls back to deterministic fixtures when no key is configured, so the
 * application runs end to end without an account — but the fallback is loud
 * rather than silent. `isLive` is false on the fixture provider, the health
 * endpoint reports a production deployment running on it as failing, and the
 * job pipeline refuses to start a customer's report at all.
 *
 * That triple is deliberate. A fabricated research provider is the single most
 * dangerous misconfiguration in this system: it produces confident,
 * well-shaped, entirely fictional sources, and nothing downstream can tell.
 * Reporting it is not enough — the job has to not run.
 */
export async function getResearchProvider(): Promise<ResearchProvider> {
  if (cached) return cached;

  const env = getEnv();

  if (!hasRealResearchProvider(env)) {
    cached = new FixtureResearchProvider();
    return cached;
  }

  const { TavilyResearchProvider } = await import('./tavily-provider');
  cached = new TavilyResearchProvider(env.TAVILY_API_KEY!);
  return cached;
}

/**
 * Resolves the retrieval transport that pairs with the provider.
 *
 * Chosen here rather than at the call site so the two can never disagree: a
 * deployment running on fixture search must not make real HTTP requests during
 * retrieval, or CI acquires network egress by accident and the fixture case
 * stops being reproducible.
 *
 * The fixture transport allows every robots check, because the fixture
 * expresses a refusal through the page fetcher instead — one place decides
 * which pages fail and why.
 */
export async function getRetrievalTransport(): Promise<RetrievalTransport> {
  const provider = await getResearchProvider();
  if (provider.isLive) return liveTransport;
  return { fetchPage: fixturePageFetcher, robotsAllows: async () => true };
}

/** Test-only: clears the memoised provider so env changes take effect. */
export function resetResearchProviderCache(): void {
  cached = null;
}
