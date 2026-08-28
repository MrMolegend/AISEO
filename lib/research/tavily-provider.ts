import 'server-only';
import { PlatformError } from '@/lib/errors';
import {
  MAX_RESULTS_PER_QUERY,
  type ResearchProvider,
  type SearchQuery,
  type SearchResponse,
  type SearchResult,
} from './provider';

/**
 * Tavily web research adapter.
 *
 * Written against the REST contract rather than the official SDK, deliberately.
 * `@tavily/core` pulls in axios, https-proxy-agent and js-tiktoken, and its
 * request path has no AbortSignal — this pipeline is built around cancellation
 * and a wall-clock budget, so a client that cannot be cancelled is the wrong
 * shape. The wire contract below (endpoint, auth header, snake_case body, and
 * the response field names) was read out of the published SDK bundle, which is
 * the authoritative description of what the API accepts.
 *
 * Requires TAVILY_API_KEY. Without it the provider is not selected at all —
 * see lib/research/index.ts, which falls back to the mock and makes the health
 * endpoint report production as failing.
 */

const ENDPOINT = 'https://api.tavily.com/search';

/** Per-request ceiling. The job's overall budget is enforced above this. */
const REQUEST_TIMEOUT_MS = 25_000;

interface TavilyResultShape {
  title?: unknown;
  url?: unknown;
  content?: unknown;
  score?: unknown;
  published_date?: unknown;
}

interface TavilyResponseShape {
  results?: unknown;
  usage?: { credits?: unknown } | null;
  detail?: { error?: unknown } | null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Normalises one result, discarding anything without a usable URL.
 *
 * A result we cannot cite is a result we cannot use: every factual claim in a
 * report has to point at a source, so a source without an address is worse than
 * no source at all.
 */
function toResult(raw: unknown): SearchResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as TavilyResultShape;

  const url = asString(row.url);
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;

  const rawScore = typeof row.score === 'number' ? row.score : 0;

  return {
    title: asString(row.title, parsed.hostname).slice(0, 300),
    url: parsed.toString(),
    excerpt: asString(row.content).slice(0, 2000),
    publishedDate: normalisePublishedDate(row.published_date),
    // Tavily scores 0–1 already, but clamping means a provider change cannot
    // silently start feeding out-of-range numbers into ranking.
    score: Math.max(0, Math.min(1, rawScore)),
  };
}

/** Keeps only dates we can actually parse; never invents one. */
function normalisePublishedDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function mapHttpError(status: number, body: string): PlatformError {
  if (status === 401 || status === 403) {
    return new PlatformError(
      'RESEARCH_PROVIDER_UNAVAILABLE',
      `Tavily rejected our credentials (${status})`,
      { context: { status } },
    );
  }
  if (status === 429) {
    return new PlatformError('RESEARCH_PROVIDER_RATE_LIMITED', 'Tavily rate limit', {
      context: { status },
    });
  }
  return new PlatformError(
    'RESEARCH_PROVIDER_UNAVAILABLE',
    `Tavily returned ${status}: ${body.slice(0, 200)}`,
    { context: { status } },
  );
}

export class TavilyResearchProvider implements ResearchProvider {
  readonly name = 'tavily';
  readonly isLive = true;

  constructor(private readonly apiKey: string) {}

  async search(query: SearchQuery, signal: AbortSignal): Promise<SearchResponse> {
    const started = Date.now();

    // Two deadlines, combined: the caller's budget for the whole job and this
    // request's own ceiling. Whichever fires first wins.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const onAbort = () => controller.abort();

    if (signal.aborted) {
      clearTimeout(timer);
      throw new PlatformError('JOB_TIMEOUT', 'Cancelled before the search started');
    }
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
          'x-client-source': 'corridor',
        },
        body: JSON.stringify({
          query: query.query,
          max_results: Math.min(query.maxResults, MAX_RESULTS_PER_QUERY),
          search_depth: query.depth ?? 'basic',
          topic: 'general',
          include_answer: false,
          // The pipeline reads pages itself, through the SSRF-guarded fetcher.
          // Taking raw content from the provider would bypass those guards and
          // the byte ceilings with them.
          include_raw_content: false,
          include_images: false,
          include_usage: true,
          ...(query.country ? { country: query.country } : {}),
          ...(query.includeDomains?.length
            ? { include_domains: query.includeDomains }
            : {}),
          ...(query.excludeDomains?.length
            ? { exclude_domains: query.excludeDomains }
            : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw mapHttpError(response.status, await response.text().catch(() => ''));
      }

      const payload = (await response.json()) as TavilyResponseShape;
      const rows = Array.isArray(payload.results) ? payload.results : [];

      const results = rows
        .map(toResult)
        .filter((r): r is SearchResult => r !== null)
        .slice(0, Math.min(query.maxResults, MAX_RESULTS_PER_QUERY));

      const credits = payload.usage?.credits;

      return {
        query: query.query,
        results,
        usage: {
          credits: typeof credits === 'number' ? credits : null,
          latencyMs: Date.now() - started,
        },
        provider: this.name,
      };
    } catch (error) {
      if (error instanceof PlatformError) throw error;

      const aborted = signal.aborted;
      const message = error instanceof Error ? error.message : String(error);

      if (aborted) {
        throw new PlatformError('JOB_TIMEOUT', 'Cancelled during a search', {
          cause: error,
        });
      }
      if (/abort/i.test(message)) {
        throw new PlatformError(
          'RESEARCH_PROVIDER_UNAVAILABLE',
          'Search timed out before the provider responded',
          { cause: error },
        );
      }
      throw new PlatformError('RESEARCH_PROVIDER_UNAVAILABLE', message, { cause: error });
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }
}
