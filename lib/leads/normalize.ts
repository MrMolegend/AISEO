import { NON_CRAWLABLE_HOSTS } from '@/lib/research/provider';
import type { SearchResult } from '@/lib/research/provider';

/**
 * Account normalisation and candidate extraction — pure functions.
 *
 * The rules are explainable on purpose:
 *
 *   · Two candidates are the same account when their normalised names are
 *     EQUAL, or their canonical domains are equal. Never a similarity
 *     score: "Pet Oasis" and "Pet Oasis LLC" normalise to the same key by
 *     suffix stripping, but "Pet Oasis" and "Pet Paradise" never merge.
 *   · A candidate only exists because a source named it. Extraction reads
 *     structure a publisher actually wrote (the segment of a title before
 *     the publication's own separator), and a result whose title yields no
 *     name yields no candidate — silence, not invention.
 *   · Directory, marketplace and social hosts identify PAGES ABOUT many
 *     businesses, so their domains never become an account's own domain.
 */

/** Legal suffixes stripped when normalising, longest first. */
const LEGAL_SUFFIXES = [
  'l.l.c',
  'llc',
  'fzco',
  'fz-llc',
  'fze',
  'ltd',
  'limited',
  'trading',
  'co',
  'company',
  'est',
  'establishment',
];

/** Hosts whose domain identifies a platform, not the business itself. */
const PLATFORM_HOSTS = new Set<string>([
  ...NON_CRAWLABLE_HOSTS,
  'yellowpages.ae',
  'dubaiyellowpages.example',
  'amazon.ae',
  'noon.com',
  'talabat.com',
]);

export function normalizeAccountName(name: string): string {
  let cleaned = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    // Dots vanish rather than becoming spaces, so "L.L.C" reads as "llc"
    // and meets the suffix list below.
    .replace(/\./g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of LEGAL_SUFFIXES) {
      const plain = suffix.replace(/\./g, '');
      if (cleaned.endsWith(` ${plain}`)) {
        cleaned = cleaned.slice(0, -(plain.length + 1)).trim();
        changed = true;
      }
    }
  }
  return cleaned;
}

/** The registrable-ish host, lowercased, without www. Null for platforms. */
export function canonicalDomain(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    for (const platform of PLATFORM_HOSTS) {
      if (host === platform || host.endsWith(`.${platform}`)) return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function isPlatformHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    for (const platform of PLATFORM_HOSTS) {
      if (host === platform || host.endsWith(`.${platform}`)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export interface CandidateAccount {
  name: string;
  normalizedName: string;
  /** The business's own domain, when the result came from its own site. */
  domain: string | null;
  websiteUrl: string | null;
  sourceUrl: string;
  sourceTitle: string;
  sourceExcerpt: string;
}

/**
 * Extracts at most one candidate business from one search result.
 *
 * Titles on the public web routinely follow "Business Name | Publication"
 * or "Business Name - Publication" or "Business Name – City's best…". The
 * business name is the first segment; everything after the separator is
 * the publisher talking. A title with no plausible name segment produces
 * nothing.
 */
export function candidateFromResult(result: SearchResult): CandidateAccount | null {
  const segment = result.title.split(/\s+[|–—-]\s+/)[0]?.trim() ?? '';
  if (segment.length < 3 || segment.length > 120) return null;
  // A name should not read as a sentence or a question.
  if (/[?!]/.test(segment)) return null;
  const wordCount = segment.split(/\s+/).length;
  if (wordCount > 8) return null;
  // Listicle and roundup headlines are publications talking, not names.
  const opening = segment.toLowerCase().replace(/^the\s+/, '');
  if (/^\d/.test(opening)) return null;
  if (/^(best|top|guide|list|where|how|what|why)\b/.test(opening)) return null;

  const normalizedName = normalizeAccountName(segment);
  if (normalizedName.length < 3) return null;

  const ownDomain = canonicalDomain(result.url);
  return {
    name: segment,
    normalizedName,
    domain: ownDomain,
    websiteUrl: ownDomain ? result.url : null,
    sourceUrl: result.url,
    sourceTitle: result.title,
    sourceExcerpt: result.excerpt,
  };
}

/**
 * Whether two candidates are the same organisation, by the explainable
 * rule: equal normalised names, or equal canonical domains. Returns the
 * reason so merge history can say why.
 */
export function sameOrganisation(
  a: { normalizedName: string; domain: string | null },
  b: { normalizedName: string; domain: string | null },
): 'name' | 'domain' | null {
  if (a.normalizedName === b.normalizedName) return 'name';
  if (a.domain && b.domain && a.domain === b.domain) return 'domain';
  return null;
}
