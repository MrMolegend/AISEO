import 'server-only';
import { getEnv, hasRealResearchProvider } from '@/lib/env';
import { MockResearchProvider } from './mock-provider';
import type { ResearchProvider } from './provider';

export type {
  ResearchProvider,
  SearchQuery,
  SearchResult,
  SearchResponse,
} from './provider';
export { MAX_RESULTS_PER_QUERY, NON_CRAWLABLE_HOSTS } from './provider';
export { MockResearchProvider } from './mock-provider';

let cached: ResearchProvider | null = null;

/**
 * Resolves the research provider.
 *
 * Falls back to the mock when no key is configured, so the application runs
 * without an account — but the fallback is loud rather than silent. The health
 * endpoint reports a production deployment running on the mock as *failing*,
 * not degraded, because a mock research provider is the most dangerous
 * misconfiguration in this system: it returns confident, well-shaped,
 * completely fictional sources, and nothing downstream can tell.
 */
export async function getResearchProvider(): Promise<ResearchProvider> {
  if (cached) return cached;

  const env = getEnv();

  if (!hasRealResearchProvider(env)) {
    cached = new MockResearchProvider();
    return cached;
  }

  const { TavilyResearchProvider } = await import('./tavily-provider');
  cached = new TavilyResearchProvider(env.TAVILY_API_KEY!);
  return cached;
}

/** Test-only: clears the memoised provider so env changes take effect. */
export function resetResearchProviderCache(): void {
  cached = null;
}
