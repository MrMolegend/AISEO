import type { CheerioAPI } from 'cheerio';
import { normalizeText, resolveUrl } from '../parse-html';
import type { MetaFacts } from '@/schemas/facts';

const cap = (value: string, max: number) =>
  value.length > max ? value.slice(0, max) : value;

export function extractMeta($: CheerioAPI, baseUrl: string): MetaFacts {
  const title = normalizeText($('head > title').first().text());
  const description = normalizeText(
    $('meta[name="description"]').attr('content') ??
      $('meta[property="og:description"]').attr('content') ??
      '',
  );

  const canonicalHref = $('link[rel="canonical"]').attr('href');
  const canonical = canonicalHref ? resolveUrl(canonicalHref, baseUrl) : null;

  return {
    title: title ? cap(title, 500) : null,
    // Length is measured on the real value, before our display cap.
    titleLength: title.length,
    description: description ? cap(description, 1000) : null,
    descriptionLength: description.length,
    canonical: canonical ? cap(canonical, 500) : null,
    robotsMeta: normalizeText($('meta[name="robots"]').attr('content')) || null,
    viewport: normalizeText($('meta[name="viewport"]').attr('content')) || null,
    lang: normalizeText($('html').attr('lang')) || null,
    charset:
      normalizeText($('meta[charset]').attr('charset')) ||
      normalizeText($('meta[http-equiv="Content-Type"]').attr('content')) ||
      null,
  };
}

/** Open Graph and Twitter Card properties, capped in both count and size. */
export function extractSocialMeta($: CheerioAPI): {
  openGraph: Record<string, string>;
  twitterCard: Record<string, string>;
} {
  const openGraph: Record<string, string> = {};
  const twitterCard: Record<string, string> = {};

  $('meta[property^="og:"], meta[property^="article:"]').each((_, element) => {
    if (Object.keys(openGraph).length >= 12) return;
    const key = $(element).attr('property');
    const value = normalizeText($(element).attr('content'));
    if (key && value) openGraph[cap(key, 60)] = cap(value, 1000);
  });

  $('meta[name^="twitter:"]').each((_, element) => {
    if (Object.keys(twitterCard).length >= 8) return;
    const key = $(element).attr('name');
    const value = normalizeText($(element).attr('content'));
    if (key && value) twitterCard[cap(key, 60)] = cap(value, 1000);
  });

  return { openGraph, twitterCard };
}
