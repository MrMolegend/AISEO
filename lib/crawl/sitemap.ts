import 'server-only';

/**
 * Sitemap discovery and parsing.
 *
 * A sitemap is the cheapest, most reliable way to learn what a site considers
 * its own pages — better than link discovery, which surfaces whatever the
 * navigation happens to expose.
 *
 * Parsed with a regex rather than an XML parser, deliberately. This input is
 * hostile by definition: an attacker chooses the URL and therefore the bytes.
 * A real XML parser brings entity expansion with it, and XXE and billion-laughs
 * are exactly the class of attack a "just parse the sitemap" feature invites.
 * We want a flat list of URLs; extracting them with a bounded pattern cannot
 * expand an entity, resolve an external reference, or recurse.
 */

/** Sitemaps nest. Two levels is normal; more is either unusual or a loop. */
export const MAX_SITEMAP_DEPTH = 2;
export const MAX_SITEMAP_URLS = 500;
/** A sitemap far larger than this is not going to help inside our page budget. */
export const MAX_SITEMAP_BYTES = 2 * 1024 * 1024;

const LOC_PATTERN =
  /<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]{1,2048}?)\s*(?:\]\]>)?\s*<\/loc>/gi;

export interface ParsedSitemap {
  /** Page URLs found directly in this document. */
  urls: string[];
  /** Nested sitemap URLs, when this is a sitemap index. */
  sitemaps: string[];
}

/**
 * Extracts URLs from a sitemap or sitemap index.
 *
 * Whether a `<loc>` is a page or another sitemap is decided by the enclosing
 * element, so the document is classified once by looking for `<sitemapindex>`.
 * Getting this backwards would mean queueing sitemap XML as pages to crawl.
 */
export function parseSitemap(xml: string): ParsedSitemap {
  const body = xml.slice(0, MAX_SITEMAP_BYTES);
  const isIndex = /<sitemapindex[\s>]/i.test(body);

  const found: string[] = [];
  let match: RegExpExecArray | null;
  LOC_PATTERN.lastIndex = 0;

  while ((match = LOC_PATTERN.exec(body)) !== null) {
    const value = decodeXmlEntities(match[1]!.trim());
    if (value) found.push(value);
    if (found.length >= MAX_SITEMAP_URLS) break;
  }

  return isIndex ? { urls: [], sitemaps: found } : { urls: found, sitemaps: [] };
}

/**
 * Decodes the five predefined XML entities and numeric character references.
 *
 * Only these. Named entities beyond the predefined five require a DTD, and
 * resolving a DTD is the thing we are avoiding. An unrecognised entity is left
 * as written, so a malformed URL stays visibly malformed rather than becoming a
 * different, valid one.
 */
function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex: string) =>
      safeFromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d{1,7});/g, (_, dec: string) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** The conventional sitemap locations, tried when robots.txt names none. */
export function defaultSitemapUrls(origin: string): string[] {
  return [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
}
