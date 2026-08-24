import type { CheerioAPI } from 'cheerio';
import { capText, normalizeText, resolveUrl } from '../parse-html';
import { FACT_LIMITS, type PageImage, type PageLink } from '@/schemas/page-facts';

export function extractHeadings($: CheerioAPI) {
  const level = (selector: string) => {
    const items: string[] = [];
    $(selector).each((_, element) => {
      if (items.length >= FACT_LIMITS.headingsPerLevel) return;
      const text = capText($(element).text(), FACT_LIMITS.headingLength);
      if (text) items.push(text);
    });
    return items;
  };

  return {
    headings: { h1: level('h1'), h2: level('h2'), h3: level('h3') },
    // Counts come from the whole document, so a page with 40 H2s reports 40 even
    // though only 30 are sampled.
    headingCounts: {
      h1: $('h1').length,
      h2: $('h2').length,
      h3: $('h3').length,
      h4: $('h4').length,
      h5: $('h5').length,
      h6: $('h6').length,
    },
  };
}

export function extractLinks($: CheerioAPI, baseUrl: string) {
  const internal: PageLink[] = [];
  const external: PageLink[] = [];
  const counts = { internal: 0, external: 0, nofollow: 0, empty: 0 };

  let baseHost: string;
  try {
    baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
  } catch {
    baseHost = '';
  }

  $('a[href]').each((_, element) => {
    const node = $(element);
    const href = node.attr('href') ?? '';
    const rel = normalizeText(node.attr('rel')) || null;
    const text = capText(node.text(), FACT_LIMITS.linkTextLength);

    if (rel && /\bnofollow\b/i.test(rel)) counts.nofollow += 1;

    // A link with neither text nor an accessible name is a real defect: screen
    // readers announce nothing and search engines get no anchor signal.
    if (!text && !node.attr('aria-label') && node.find('img[alt]').length === 0) {
      counts.empty += 1;
    }

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) return;

    let host: string;
    try {
      host = new URL(resolved).hostname.replace(/^www\./, '');
    } catch {
      return;
    }

    const entry: PageLink = { href: resolved.slice(0, FACT_LIMITS.urlLength), text, rel };

    if (host === baseHost) {
      counts.internal += 1;
      if (internal.length < FACT_LIMITS.internalLinks) internal.push(entry);
    } else {
      counts.external += 1;
      if (external.length < FACT_LIMITS.externalLinks) external.push(entry);
    }
  });

  return { internal, external, counts };
}

export function extractImages($: CheerioAPI, baseUrl: string) {
  const sample: PageImage[] = [];
  const counts = { total: 0, missingAlt: 0, emptyAlt: 0, lazyLoaded: 0 };

  $('img').each((_, element) => {
    const node = $(element);
    counts.total += 1;

    const alt = node.attr('alt');
    // Absent alt and empty alt are different findings: the first is an omission,
    // the second is a valid declaration that an image is decorative.
    if (alt === undefined) counts.missingAlt += 1;
    else if (alt.trim() === '') counts.emptyAlt += 1;

    const loading = normalizeText(node.attr('loading')) || null;
    if (loading === 'lazy') counts.lazyLoaded += 1;

    if (sample.length >= FACT_LIMITS.imageSamples) return;

    const rawSrc = node.attr('src') ?? node.attr('data-src') ?? '';
    const resolved = resolveUrl(rawSrc, baseUrl);

    sample.push({
      src: (resolved ?? rawSrc).slice(0, FACT_LIMITS.urlLength),
      alt: alt === undefined ? null : capText(alt, 300),
      loading,
      width: normalizeText(node.attr('width')) || null,
      height: normalizeText(node.attr('height')) || null,
    });
  });

  return { sample, counts };
}

export function extractStructuredData($: CheerioAPI) {
  const types: string[] = [];
  const blocks: unknown[] = [];
  let parseErrors = 0;

  $('script[type="application/ld+json"]').each((_, element) => {
    if (blocks.length >= FACT_LIMITS.structuredDataBlocks) return;

    const raw = $(element).contents().text();
    if (!raw.trim()) return;

    try {
      const parsed: unknown = JSON.parse(raw);
      // A @graph array and a bare array are both common; flatten either.
      const entries = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && '@graph' in parsed
          ? ((parsed as { '@graph': unknown })['@graph'] as unknown[])
          : [parsed];

      for (const entry of Array.isArray(entries) ? entries : [entries]) {
        if (blocks.length >= FACT_LIMITS.structuredDataBlocks) break;
        blocks.push(entry);
        const type =
          entry && typeof entry === 'object' && '@type' in entry
            ? (entry as { '@type': unknown })['@type']
            : null;
        if (typeof type === 'string' && !types.includes(type))
          types.push(type.slice(0, 80));
        else if (Array.isArray(type)) {
          for (const t of type) {
            if (typeof t === 'string' && !types.includes(t)) types.push(t.slice(0, 80));
          }
        }
      }
    } catch {
      // A malformed block is itself a finding — search engines ignore it too.
      parseErrors += 1;
    }
  });

  return { types: types.slice(0, 20), blocks, parseErrors };
}

export function extractContent($: CheerioAPI) {
  // Chrome, navigation and footers are stripped so the word count reflects the
  // page's actual substance rather than its furniture.
  const body = $('body').clone();
  body.find('nav, header, footer, aside').remove();

  const raw = normalizeText(body.text());
  const truncated = raw.length > FACT_LIMITS.contentChars;
  const text = truncated ? raw.slice(0, FACT_LIMITS.contentChars) : raw;

  return {
    text,
    wordCount: raw ? raw.split(/\s+/).filter(Boolean).length : 0,
    truncated,
  };
}

export function extractTechnical($: CheerioAPI, isHttps: boolean, wordCount: number) {
  const scripts = $('script');
  const externalScripts = scripts.filter((_, element) => Boolean($(element).attr('src')));

  // Mixed content: an https page pulling http subresources.
  let hasHttpResourcesOnHttps = false;
  if (isHttps) {
    $('[src], [href]').each((_, element) => {
      if (hasHttpResourcesOnHttps) return;
      const value = $(element).attr('src') ?? $(element).attr('href') ?? '';
      if (/^http:\/\//i.test(value)) hasHttpResourcesOnHttps = true;
    });
  }

  /*
   * SPA-shell heuristic.
   *
   * Very little text alongside a real script payload almost always means the
   * content is rendered in the browser. V1 cannot see that content, and saying
   * so honestly is far better than auditing an empty shell — so this flag
   * ultimately fails the audit with a clear explanation rather than producing a
   * confident report about nothing.
   */
  const likelyClientRendered = wordCount < 120 && externalScripts.length >= 2;

  return {
    hasHreflang: $('link[rel="alternate"][hreflang]').length > 0,
    hasAmp: $('link[rel="amphtml"]').length > 0,
    inlineStyleCount: $('[style]').length,
    scriptCount: scripts.length,
    externalScriptCount: externalScripts.length,
    iframeCount: $('iframe').length,
    formCount: $('form').length,
    hasHttpResourcesOnHttps,
    likelyClientRendered,
  };
}
