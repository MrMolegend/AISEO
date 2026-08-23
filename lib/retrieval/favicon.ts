import { resolveUrl } from '@/lib/extraction/parse-html';
import type { CheerioAPI } from 'cheerio';

/**
 * Resolves the page's favicon.
 *
 * Declared icons are preferred over the /favicon.ico convention, and the largest
 * declared size wins so the report header is not stuck with a 16px bitmap. The
 * URL is never fetched here — it is handed to the browser, which is also the only
 * thing that can tell us whether it actually loads.
 */
export function resolveFavicon($: CheerioAPI, baseUrl: string): string | null {
  const candidates: { href: string; size: number }[] = [];

  $('link[rel~="icon"], link[rel="apple-touch-icon"]').each((_, element) => {
    const href = $(element).attr('href');
    if (!href) return;
    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) return;

    // sizes="32x32" or "any"; treat "any" (usually SVG) as the best option.
    const sizes = $(element).attr('sizes') ?? '';
    const size = /any/i.test(sizes)
      ? 1024
      : Number.parseInt(sizes.split(/[x\s]/)[0] ?? '', 10) || 16;

    candidates.push({ href: resolved, size });
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.size - a.size);
    return candidates[0]!.href.slice(0, 500);
  }

  try {
    return new URL('/favicon.ico', baseUrl).toString();
  } catch {
    return null;
  }
}
