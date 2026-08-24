/**
 * URL normalisation, deduplication and prioritisation.
 *
 * A crawler with a page budget spends it on whatever it happens to find first
 * unless something decides otherwise. On a business website that is usually the
 * navigation — which means blog posts and legal pages, and not the pricing page
 * the report actually needs. This module is that decision.
 *
 * Deduplication matters as much as ordering. The same page routinely appears
 * under half a dozen addresses: with and without a trailing slash, with a
 * tracking parameter, with a fragment, under http and https, with and without
 * `www`. Fetching all six wastes most of a 25-page budget on one page.
 */

/**
 * Query parameters that never change what a page says.
 *
 * Removing them is what collapses `?utm_source=x` variants onto one URL. The
 * list is conservative: a parameter that might select content — `id`, `page`,
 * `q` — is left alone, because dropping it would merge genuinely different
 * pages into one.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  'source',
  '_ga',
  '_gl',
  'igshid',
  'ttclid',
  'yclid',
  'hsa_acc',
  'hsa_cam',
  '_hsenc',
  '_hsmi',
]);

/**
 * Path segments worth spending the budget on, best first.
 *
 * These are the pages that carry what a business actually sells, to whom, and
 * for how much. A blog index is interesting to a search engine and nearly
 * useless for working out a company's positioning.
 */
const PRIORITY_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /^\/?$/, weight: 100 }, // homepage
  { pattern: /^\/(pricing|plans|packages|price|tariffs?)(\/|$)/i, weight: 95 },
  { pattern: /^\/(products?|services?|solutions?|what-we-do)(\/|$)/i, weight: 90 },
  { pattern: /^\/(about|about-us|who-we-are|our-story|company)(\/|$)/i, weight: 85 },
  {
    pattern: /^\/(case-stud(y|ies)|customers?|clients?|work|portfolio)(\/|$)/i,
    weight: 78,
  },
  { pattern: /^\/(contact|contact-us|get-in-touch|enquir)(\/|$)/i, weight: 72 },
  {
    pattern: /^\/(locations?|stores?|branches|where-we-work|areas?-we-serve)(\/|$)/i,
    weight: 68,
  },
  { pattern: /^\/(industries|sectors|markets|for-)(\/|$|-)/i, weight: 62 },
  { pattern: /^\/(team|people|leadership|our-team)(\/|$)/i, weight: 50 },
  { pattern: /^\/(faq|help|support|knowledge)(\/|$)/i, weight: 40 },
  { pattern: /^\/(blog|news|insights|articles|press|resources)(\/|$)/i, weight: 25 },
];

/**
 * Paths never worth fetching.
 *
 * Two kinds: pages that cannot say anything about the business (a cart, a
 * login), and pages that generate infinite variants (search results, faceted
 * filters, paginated archives) which would consume the entire budget on
 * near-identical content.
 */
const EXCLUDED_PATTERNS: RegExp[] = [
  /^\/(login|log-in|signin|sign-in|register|signup|sign-up|auth|account|my-account|dashboard|admin|wp-admin|wp-login)(\/|$|\.php)/i,
  /^\/(logout|log-out|signout|sign-out)(\/|$)/i,
  /^\/(cart|basket|checkout|order|payment|billing)(\/|$)/i,
  /^\/(search|s)(\/|$)/i,
  /^\/(feed|rss|atom|sitemap.*\.xml|wp-json)(\/|$)/i,
  /^\/(tag|tags|category|categories|author|archive|page)\/\d*/i,
  /\.(pdf|zip|dmg|exe|mp4|mp3|jpg|jpeg|png|gif|svg|webp|ico|css|js|woff2?|ttf|eot)$/i,
  /^\/(privacy|terms|cookie|legal|gdpr|imprint|impressum|disclaimer)(\/|$)/i,
];

/** Query keys that signal a filtered or paginated view rather than a page. */
const FACET_KEYS =
  /^(page|p|paged|offset|start|sort|order|orderby|filter|facet|per_page|limit|view|colour|color|size|min_price|max_price)$/i;

export interface NormalizedUrl {
  /** Canonical form, used for deduplication and storage. */
  url: string;
  hostname: string;
  path: string;
}

/**
 * Reduces a URL to one canonical form.
 *
 * Returns null for anything we would never fetch, so callers get one predicate
 * rather than a normalise-then-check dance they might forget half of.
 */
export function normalizeUrl(raw: string, base?: string): NormalizedUrl | null {
  let parsed: URL;
  try {
    parsed = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  if (parsed.username || parsed.password) return null;

  // Fragments are a browser concern; the server returns the same bytes.
  parsed.hash = '';

  // Lowercase the host and drop a `www.` that means the same site. Paths stay
  // case-sensitive, because on many servers they genuinely are.
  parsed.hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (parsed.hostname.startsWith('www.')) {
    parsed.hostname = parsed.hostname.slice(4);
  }

  if (
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    (parsed.protocol === 'http:' && parsed.port === '80')
  ) {
    parsed.port = '';
  }

  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key);
  }
  // Sorting means ?a=1&b=2 and ?b=2&a=1 are one URL rather than two.
  parsed.searchParams.sort();

  // Collapse `/about/` and `/about` — but never collapse the root to empty.
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  }
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');

  return {
    url: parsed.toString(),
    hostname: parsed.hostname,
    path: parsed.pathname,
  };
}

/**
 * The registrable-ish domain, for "is this the same site" comparisons.
 *
 * A deliberate approximation: a full public-suffix list is a large dependency
 * that needs updating, and this is used to decide whether to spend a page of
 * budget, not to make a security decision. The SSRF guard makes those, and it
 * does not consult this.
 */
export function registrableDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');

  const lastTwo = parts.slice(-2).join('.');
  // Handles co.uk, com.au, org.nz and friends, where the last two labels are
  // the suffix rather than the domain.
  const compoundSuffix = /^(co|com|org|net|gov|edu|ac|ltd|plc|me|or|ne)\.[a-z]{2}$/;
  if (compoundSuffix.test(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

export function isSameSite(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b);
}

/** Whether a path is one we would never spend budget on. */
export function isExcludedPath(path: string, search = ''): boolean {
  if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(path))) return true;

  if (search) {
    const params = new URLSearchParams(search);
    for (const key of params.keys()) {
      if (FACET_KEYS.test(key)) return true;
    }
  }

  // Very deep paths are almost always generated archives.
  if (path.split('/').filter(Boolean).length > 5) return true;

  return false;
}

/**
 * Score for crawl ordering. Higher is fetched first.
 *
 * Shallower wins among equals: a company's real services page is at /services,
 * and /resources/blog/2019/03/some-post is not the page we are looking for.
 */
export function priorityOf(path: string): number {
  for (const { pattern, weight } of PRIORITY_PATTERNS) {
    if (pattern.test(path)) {
      const depth = path.split('/').filter(Boolean).length;
      return weight - Math.min(depth * 2, 12);
    }
  }
  const depth = path.split('/').filter(Boolean).length;
  return Math.max(5, 35 - depth * 6);
}

export interface FrontierEntry {
  url: string;
  path: string;
  priority: number;
  /** Where we learned about this URL, for the source registry. */
  discoveredVia: 'seed' | 'sitemap' | 'link';
}

/**
 * The crawl queue.
 *
 * Deduplication happens on `add`, not on `take`, so a URL discovered fifty
 * times costs one map lookup each rather than a place in the queue.
 */
export class UrlFrontier {
  private readonly seen = new Set<string>();
  private readonly queue: FrontierEntry[] = [];

  constructor(private readonly siteHostname: string) {}

  /** Returns true if the URL was newly queued. */
  add(
    raw: string,
    discoveredVia: FrontierEntry['discoveredVia'],
    base?: string,
  ): boolean {
    const normalized = normalizeUrl(raw, base);
    if (!normalized) return false;

    if (!isSameSite(normalized.hostname, this.siteHostname)) return false;
    if (this.seen.has(normalized.url)) return false;

    const search = new URL(normalized.url).search;
    if (isExcludedPath(normalized.path, search)) return false;

    this.seen.add(normalized.url);
    this.queue.push({
      url: normalized.url,
      path: normalized.path,
      priority: priorityOf(normalized.path),
      discoveredVia,
    });
    return true;
  }

  /** Highest-priority entry, or null when empty. */
  take(): FrontierEntry | null {
    if (this.queue.length === 0) return null;

    let bestIndex = 0;
    for (let i = 1; i < this.queue.length; i += 1) {
      if (this.queue[i]!.priority > this.queue[bestIndex]!.priority) bestIndex = i;
    }
    return this.queue.splice(bestIndex, 1)[0]!;
  }

  get pending(): number {
    return this.queue.length;
  }

  get discovered(): number {
    return this.seen.size;
  }
}
