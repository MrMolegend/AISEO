import 'server-only';
import { parseHtml } from './parse-html';
import { extractMeta, extractSocialMeta } from './extractors/meta';
import {
  extractContent,
  extractHeadings,
  extractImages,
  extractLinks,
  extractStructuredData,
  extractTechnical,
} from './extractors/structure';
import { computeChecks } from './checks';
import { siteFactsSchema, type SiteFacts } from '@/schemas/facts';
import type { SafeFetchResult } from '@/lib/security/safe-fetch';
import type { RobotsResult } from '@/lib/retrieval/robots';
import { PlatformError } from '@/lib/errors';

export interface BuildFactsInput {
  requestedUrl: string;
  fetched: SafeFetchResult;
  robots: RobotsResult;
  faviconUrl: string | null;
}

/**
 * Assembles the deterministic half of an audit.
 *
 * The result is validated against siteFactsSchema before being returned. That is
 * not ceremony: these facts go straight into an AI prompt, and the schema's caps
 * are the token budget. A page with 4,000 links must not become a $40 API call,
 * and the only way to guarantee that is to fail loudly here if a cap was missed.
 */
export function buildFacts(input: BuildFactsInput): SiteFacts {
  const { requestedUrl, fetched, robots, faviconUrl } = input;
  const { raw, visible } = parseHtml(fetched.body);

  const baseUrl = fetched.finalUrl;
  const isHttps = baseUrl.startsWith('https://');

  const meta = extractMeta(raw, baseUrl);
  const { openGraph, twitterCard } = extractSocialMeta(raw);
  const { headings, headingCounts } = extractHeadings(visible);
  const content = extractContent(visible);
  const links = extractLinks(visible, baseUrl);
  const images = extractImages(visible, baseUrl);
  const structuredData = extractStructuredData(raw);
  // Technical counts read the raw document: scripts and iframes are facts about
  // the page even though they are stripped before text extraction.
  const technical = extractTechnical(raw, isHttps, content.wordCount);

  const withoutChecks = {
    fetchedAt: new Date().toISOString(),
    requestedUrl: requestedUrl.slice(0, 500),
    finalUrl: baseUrl.slice(0, 500),
    redirectChain: fetched.redirectChain.slice(0, 5).map((u) => u.slice(0, 500)),
    httpStatus: fetched.status,
    responseTimeMs: fetched.responseTimeMs,
    htmlBytes: fetched.bytes,
    isHttps,
    faviconUrl: faviconUrl ? faviconUrl.slice(0, 500) : null,
    meta,
    openGraph,
    twitterCard,
    headings,
    headingCounts,
    content,
    links,
    images,
    structuredData,
    robotsTxt: {
      found: robots.found,
      allowsOurAgent: robots.allowsOurAgent,
      sitemapUrls: robots.sitemapUrls.slice(0, 10).map((u) => u.slice(0, 500)),
    },
    sitemapXml: {
      found: robots.sitemapUrls.length > 0,
      url: robots.sitemapUrls[0]?.slice(0, 500) ?? null,
    },
    technical,
  };

  const facts = { ...withoutChecks, checks: computeChecks(withoutChecks) };

  const parsed = siteFactsSchema.safeParse(facts);
  if (!parsed.success) {
    // A cap breach here would silently inflate the prompt, so it is a hard error
    // rather than something to trim and continue past.
    throw new PlatformError('UNKNOWN', 'Extracted facts failed their own schema', {
      context: {
        issues: parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')}: ${i.message}`),
      },
    });
  }

  return parsed.data;
}

/**
 * Refuses pages we cannot honestly audit.
 *
 * Called after extraction so the error can explain *why* — an SPA shell and a
 * genuinely empty page are different problems, and the client-rendered case is
 * itself a real SEO finding worth telling the user about.
 */
export function assertAuditable(facts: SiteFacts): void {
  if (facts.technical.likelyClientRendered) {
    throw new PlatformError('NO_CONTENT', 'Page appears to be a client-rendered shell', {
      context: {
        wordCount: facts.content.wordCount,
        externalScripts: facts.technical.externalScriptCount,
      },
    });
  }

  if (facts.content.wordCount < 30 && facts.headingCounts.h1 === 0 && !facts.meta.title) {
    throw new PlatformError('NO_CONTENT', 'Page has no usable content', {
      context: { wordCount: facts.content.wordCount },
    });
  }
}
