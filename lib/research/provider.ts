/**
 * The web-research boundary.
 *
 * Claude cannot know which companies exist today, who is competing with whom,
 * or which creators have an audience this month. Its training data has a cutoff
 * and the answers change weekly. Every current fact in a report therefore has
 * to enter through this interface, from a service whose job is knowing what is
 * published right now.
 *
 * The interface is deliberately narrow — a query in, ranked results out. It is
 * not a crawler (that is lib/crawl), and it is not an extractor. Keeping it
 * this thin is what makes swapping providers a one-file change, and what stops
 * provider-specific concepts leaking into the pipeline.
 *
 * Results from here are untrusted third-party text. Titles and excerpts are
 * written by whoever published the page, which includes anyone who would like
 * to write instructions into a page and see whether we follow them. They are
 * treated as data at every point downstream.
 */

export interface SearchQuery {
  /** The query string. Built by the pipeline, never by the user directly. */
  query: string;
  /** Upper bound on results. Providers may return fewer; never more. */
  maxResults: number;
  /**
   * ISO 3166-1 alpha-2, when the pipeline wants geographically-relevant
   * results. Advisory: providers weight it rather than filtering on it, and a
   * report should say "prefers this market" rather than claim it filtered.
   */
  country?: string;
  /** Restrict to these registrable domains. */
  includeDomains?: string[];
  /** Never return results from these domains. */
  excludeDomains?: string[];
  /**
   * Whether the query needs depth over speed. The pipeline uses this sparingly:
   * deep searches cost more and most queries do not need one.
   */
  depth?: 'basic' | 'advanced';
  /**
   * Which investigation area asked this question.
   *
   * Advisory metadata that live providers ignore — it is not sent to Tavily and
   * has no effect on a real search. It exists so the deterministic fixture
   * provider can answer a real twelve-query plan with twelve different result
   * sets rather than returning one canned list twelve times, which would make
   * source deduplication look like it worked when it had never been exercised.
   */
  area?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  /** A short extract the provider considered relevant. Untrusted text. */
  excerpt: string;
  /** ISO date where the provider could determine one. */
  publishedDate: string | null;
  /**
   * Provider relevance score, normalised to 0–1.
   *
   * Deliberately not surfaced to the model as a fact about the company: it
   * measures how well a page matched a query, which is not evidence of anything
   * about the business on that page.
   */
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  /** What this call cost, where the provider reports it. */
  usage: {
    /** Provider-defined credits, if reported. */
    credits: number | null;
    latencyMs: number;
  };
  /** Which provider answered, for the report's provenance. */
  provider: string;
}

export interface ResearchProvider {
  readonly name: string;
  /** False for the mock, which the health check treats as a failing state. */
  readonly isLive: boolean;

  search(query: SearchQuery, signal: AbortSignal): Promise<SearchResponse>;
}

/** Hard ceiling on any single query, regardless of what a caller asks for. */
export const MAX_RESULTS_PER_QUERY = 20;

/**
 * Platforms whose terms forbid the automated access a crawler would perform.
 *
 * We still surface public web results *about* a creator or company on these
 * hosts — a search provider's index is its own to license — but we never fetch
 * pages from them ourselves, and the report says where a fact came from either
 * way. See lib/crawl/policy.ts, which enforces the fetching half.
 */
export const NON_CRAWLABLE_HOSTS = [
  'instagram.com',
  'facebook.com',
  'tiktok.com',
  'linkedin.com',
  'x.com',
  'twitter.com',
  'threads.net',
  'google.com',
  'maps.google.com',
] as const;
