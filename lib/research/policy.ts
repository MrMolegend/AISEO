import { NON_CRAWLABLE_HOSTS } from './provider';

/**
 * What we are willing to fetch ourselves.
 *
 * The distinction this file draws matters both legally and editorially:
 *
 *   · A search provider's index is its own to license, so a *result* pointing
 *     at a social platform is fine to cite — we are reporting that a page
 *     exists and what the index says about it.
 *   · Fetching that page ourselves is automated access to a platform whose
 *     terms forbid it. We do not do it, we do not try to look like a browser,
 *     and we do not route around a block.
 *
 * The practical consequence in a report is that a creator's follower count is
 * "not reliably available" unless a source we were allowed to read stated it.
 * That is a worse-looking report and a more honest one.
 */

function registrableSuffixMatch(hostname: string, blocked: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return host === blocked || host.endsWith(`.${blocked}`);
}

/** Whether we may fetch this URL with our own crawler. */
export function isCrawlable(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  return !NON_CRAWLABLE_HOSTS.some((blocked) =>
    registrableSuffixMatch(parsed.hostname, blocked),
  );
}

/** Whether a URL may be cited as a source even though we did not fetch it. */
export function isCitableWithoutFetch(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Human-readable reason, for the report's limitations section. */
export function nonCrawlableReason(url: string): string | null {
  if (isCrawlable(url)) return null;
  try {
    const { hostname } = new URL(url);
    return `${hostname} restricts automated access, so this was recorded from public search results rather than read directly.`;
  } catch {
    return 'This address could not be read directly.';
  }
}
