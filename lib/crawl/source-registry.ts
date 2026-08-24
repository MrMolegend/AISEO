import { createHash } from 'node:crypto';

/**
 * The source registry.
 *
 * Every factual claim in a report has to point at something. This is the
 * something: a numbered list of URLs, assigned in the order they were first
 * used, which the model is given as `S1`, `S2`, `S3` and must cite by id.
 *
 * The numbering has to be stable for the life of a job, which is why ids are
 * assigned on first registration and never reassigned. A citation that
 * renumbers when the registry is re-sorted is a citation that points at the
 * wrong page — a quiet, plausible, entirely wrong report.
 *
 * Registering is idempotent by canonical URL, so a page discovered through
 * search and again through the crawl is one source with one id rather than two
 * that appear to corroborate each other.
 */

export type SourceType =
  | 'web_page'
  | 'search_result'
  | 'sitemap'
  | 'robots'
  | 'directory'
  | 'review_site'
  | 'social_profile';

export interface RegisteredSource {
  /** `S1`, `S2`, … Stable for the life of the job. */
  ref: string;
  /** 1-based, matching the numeric part of `ref`. */
  position: number;
  url: string;
  title: string | null;
  type: SourceType;
  publisherDomain: string | null;
  retrievedAt: string;
  httpStatus: number | null;
  contentHash: string | null;
  /** A short relevant extract. Never a whole page. */
  excerpt: string | null;
  /** Whether we read this page ourselves or only saw it in an index. */
  fetched: boolean;
}

export const MAX_EXCERPT_CHARS = 1200;

export class SourceRegistry {
  private readonly byUrl = new Map<string, RegisteredSource>();
  private readonly order: RegisteredSource[] = [];

  constructor(private readonly maxSources: number) {}

  /**
   * Registers a URL, or returns the existing entry.
   *
   * Returns null once the registry is full rather than growing without bound.
   * A caller that gets null should stop offering sources, not retry — the
   * budget is the budget.
   */
  register(input: {
    url: string;
    title?: string | null;
    type: SourceType;
    httpStatus?: number | null;
    excerpt?: string | null;
    content?: string | null;
    fetched?: boolean;
  }): RegisteredSource | null {
    const canonical = canonicalise(input.url);
    if (!canonical) return null;

    const existing = this.byUrl.get(canonical);
    if (existing) {
      // Upgrade in place: a source first seen as a search result and later
      // actually fetched keeps its id and gains the better information.
      if (input.fetched && !existing.fetched) {
        existing.fetched = true;
        existing.httpStatus = input.httpStatus ?? existing.httpStatus;
        existing.type = input.type;
      }
      if (!existing.title && input.title) existing.title = truncate(input.title, 300);
      if (!existing.excerpt && input.excerpt) {
        existing.excerpt = truncate(input.excerpt, MAX_EXCERPT_CHARS);
      }
      if (!existing.contentHash && input.content) {
        existing.contentHash = hashContent(input.content);
      }
      return existing;
    }

    if (this.order.length >= this.maxSources) return null;

    const position = this.order.length + 1;
    const source: RegisteredSource = {
      ref: `S${position}`,
      position,
      url: canonical,
      title: input.title ? truncate(input.title, 300) : null,
      type: input.type,
      publisherDomain: domainOf(canonical),
      retrievedAt: new Date().toISOString(),
      httpStatus: input.httpStatus ?? null,
      contentHash: input.content ? hashContent(input.content) : null,
      excerpt: input.excerpt ? truncate(input.excerpt, MAX_EXCERPT_CHARS) : null,
      fetched: input.fetched ?? false,
    };

    this.byUrl.set(canonical, source);
    this.order.push(source);
    return source;
  }

  get(ref: string): RegisteredSource | null {
    return this.order[refToIndex(ref)] ?? null;
  }

  has(ref: string): boolean {
    return this.get(ref) !== null;
  }

  all(): readonly RegisteredSource[] {
    return this.order;
  }

  get size(): number {
    return this.order.length;
  }

  get isFull(): boolean {
    return this.order.length >= this.maxSources;
  }

  /** Sources we actually read, as opposed to ones we only saw listed. */
  fetched(): RegisteredSource[] {
    return this.order.filter((s) => s.fetched);
  }

  /**
   * The registry as the model sees it.
   *
   * Ids and URLs only — no excerpts, because the excerpts are already in the
   * research context and repeating them would double the token cost of the
   * largest part of the prompt.
   */
  toPromptList(): string {
    return this.order
      .map((s) => `${s.ref}: ${s.url}${s.title ? ` — ${s.title}` : ''}`)
      .join('\n');
  }
}

/** `S3` → index 2. Returns -1 for anything malformed. */
function refToIndex(ref: string): number {
  const match = /^S(\d{1,4})$/.exec(ref.trim());
  if (!match) return -1;
  return Number(match[1]) - 1;
}

/** Whether a string looks like a source reference at all. */
export function isSourceRef(value: string): boolean {
  return /^S\d{1,4}$/.test(value.trim());
}

/** Extracts every `S<n>` mentioned in a block of text. */
export function extractSourceRefs(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\bS(\d{1,4})\b/g)) {
    found.add(`S${match[1]}`);
  }
  return [...found];
}

function canonicalise(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return null;
  }
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function truncate(value: string, max: number): string {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length <= max ? collapsed : `${collapsed.slice(0, max - 1)}…`;
}

/**
 * Content hash, so a report can show whether a page has changed since it was
 * read. Cheap to compute and worth more than a timestamp alone.
 */
function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 32);
}
