import 'server-only';
import { parseHtml, normalizeText, capText } from '@/lib/extraction/parse-html';
import { extractMeta, extractSocialMeta } from '@/lib/extraction/extractors/meta';
import {
  extractHeadings,
  extractLinks,
  extractStructuredData,
  extractContent,
} from '@/lib/extraction/extractors/structure';

/**
 * Deterministic facts about one crawled page.
 *
 * The load-bearing rule of this whole system: the crawler owns facts, the model
 * owns interpretation. The model is never asked what a page says about pricing
 * — it is given the page's actual text, with its actual headings, and asked
 * what that implies. This is the single biggest defence against a report that
 * reads beautifully and describes a company that does not exist.
 *
 * There is no AI call here and there must never be one. A crawl of 25 pages
 * that made one model call per page would cost more than the report and take
 * longer than the budget. Pages are reduced to bounded facts, and one synthesis
 * call sees all of them together.
 *
 * Everything extracted is third-party text and is treated as untrusted from
 * here on: it is JSON-encoded into a nonce-delimited block before it reaches a
 * prompt, and the model is told it is data.
 */

export interface PageFacts {
  url: string;
  path: string;
  httpStatus: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  lang: string | null;
  headings: { h1: string[]; h2: string[]; h3: string[] };
  /** Collapsed visible text, capped. */
  text: string;
  wordCount: number;
  /** Whether the page looks like an empty shell that renders in the browser. */
  likelyClientRendered: boolean;
  /** schema.org @type values found, deduplicated. */
  structuredDataTypes: string[];
  openGraph: Record<string, string>;
  /** Internal links, for crawl discovery. Not part of the research context. */
  internalLinks: string[];
  externalLinks: string[];
  /** Candidate contact routes found on the page, never guessed. */
  contact: {
    /** Addresses printed on the page. Never derived from a name. */
    publishedEmails: string[];
    /** Links to a contact page, so a report can point somewhere useful. */
    contactPaths: string[];
    socialProfiles: string[];
  };
  /** Decoded bytes read for this page. */
  bytes: number;
}

/** Per-page cap on text kept for the research context. */
export const MAX_PAGE_TEXT_CHARS = 6000;

/**
 * Matches an address that is actually written on the page.
 *
 * Deliberately conservative, and never used to construct an address. The
 * product rule is that we publish a company's email only where the company
 * published it — guessing `firstname@company.com` is both useless and the kind
 * of thing that gets a sender blocked.
 */
const EMAIL_PATTERN = /\b[a-z0-9][a-z0-9._%+-]{0,63}@([a-z0-9-]+\.)+[a-z]{2,24}\b/gi;

/** Addresses that are examples, tracking pixels or image sprites rather than contacts. */
const EMAIL_NOISE =
  /^(example|test|noreply|no-reply|donotreply|sentry|wixpress|\d+x\d+)/i;

const SOCIAL_HOSTS = [
  'linkedin.com',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'youtube.com',
  'tiktok.com',
];

export function buildPageFacts(input: {
  url: string;
  html: string;
  httpStatus: number;
  bytes: number;
}): PageFacts {
  const parsed = parseHtml(input.html);
  const meta = extractMeta(parsed.raw, input.url);
  const social = extractSocialMeta(parsed.raw);
  const headingData = extractHeadings(parsed.visible);
  const content = extractContent(parsed.visible);
  const links = extractLinks(parsed.raw, input.url);
  const structured = extractStructuredData(parsed.raw);

  const path = safePath(input.url);
  const text = capText(content.text, MAX_PAGE_TEXT_CHARS);

  return {
    url: input.url,
    path,
    httpStatus: input.httpStatus,
    title: meta.title,
    metaDescription: meta.description,
    canonical: meta.canonical,
    lang: meta.lang,
    headings: {
      h1: headingData.headings.h1.slice(0, 10),
      h2: headingData.headings.h2.slice(0, 20),
      h3: headingData.headings.h3.slice(0, 20),
    },
    text,
    wordCount: content.wordCount,
    // A page with almost no words but plenty of script tags is a shell. Saying
    // so honestly is better than reporting that a company says nothing about
    // itself.
    likelyClientRendered: content.wordCount < 120 && parsed.raw('script').length >= 4,
    structuredDataTypes: structured.types.slice(0, 12),
    openGraph: social.openGraph,
    internalLinks: links.internal.map((l) => l.href).slice(0, 150),
    externalLinks: links.external.map((l) => l.href).slice(0, 60),
    contact: {
      publishedEmails: extractPublishedEmails(input.html),
      contactPaths: links.internal
        .filter((l) => /contact|enquir|get-in-touch|support/i.test(l.href))
        .map((l) => l.href)
        .slice(0, 5),
      socialProfiles: links.external
        .filter((l) => SOCIAL_HOSTS.some((host) => l.href.includes(host)))
        .map((l) => l.href)
        .slice(0, 10),
    },
    bytes: input.bytes,
  };
}

/**
 * Addresses printed on the page, deduplicated and filtered.
 *
 * Read from the raw HTML rather than the visible text so that `mailto:` links
 * count — a contact address is frequently only in the href.
 */
function extractPublishedEmails(html: string): string[] {
  const found = new Set<string>();

  for (const match of html.matchAll(EMAIL_PATTERN)) {
    const address = match[0].toLowerCase();
    const local = address.split('@')[0] ?? '';

    if (EMAIL_NOISE.test(local)) continue;
    // Filenames like logo@2x.png match the pattern and are not addresses.
    if (/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(address)) continue;
    if (address.length > 120) continue;

    found.add(address);
    if (found.size >= 5) break;
  }

  return [...found];
}

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}

/**
 * Condenses many pages into the bounded block the model actually sees.
 *
 * Ordered by crawl priority rather than discovery order, and truncated at a
 * character budget, so the pages that matter survive the cut. Every page keeps
 * its URL and source ref, because a fact the model cannot attribute is a fact
 * the validator will reject.
 */
export function summarisePages(
  pages: Array<{ facts: PageFacts; sourceRef: string }>,
  maxChars: number,
): string {
  const blocks: string[] = [];
  let used = 0;

  for (const { facts, sourceRef } of pages) {
    const block = [
      `--- ${sourceRef} | ${facts.url}`,
      facts.title ? `title: ${facts.title}` : null,
      facts.metaDescription ? `description: ${facts.metaDescription}` : null,
      facts.headings.h1.length ? `h1: ${facts.headings.h1.join(' | ')}` : null,
      facts.headings.h2.length
        ? `h2: ${facts.headings.h2.slice(0, 12).join(' | ')}`
        : null,
      facts.structuredDataTypes.length
        ? `schema.org: ${facts.structuredDataTypes.join(', ')}`
        : null,
      facts.contact.publishedEmails.length
        ? `published contact addresses: ${facts.contact.publishedEmails.join(', ')}`
        : null,
      facts.likelyClientRendered
        ? 'note: this page returned almost no text and appears to render in the browser'
        : null,
      facts.text ? `text: ${facts.text}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    if (used + block.length > maxChars) break;
    blocks.push(block);
    used += block.length;
  }

  return blocks.join('\n\n');
}

/** Normalises a heading or title for comparison. Exported for tests. */
export function normaliseForComparison(value: string): string {
  return normalizeText(value).toLowerCase();
}
