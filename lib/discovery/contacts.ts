import type { SearchResult } from '@/lib/research/provider';
import { normalizeAccountName } from '@/lib/leads/normalize';

/**
 * Decision-maker extraction — pure, deliberately conservative.
 *
 * A contact is only created when a public source actually published a
 * person's name, a role, and the company, in the structured
 * "Name – Role – Company" shape indexed profile titles use, or nothing is
 * created at all. There is no inference of emails, phone numbers, or
 * seniority; employment_confidence is 'unverified' until a person
 * confirms it, because an indexed snippet is a claim about a moment the
 * index last looked.
 */

/** Roles relevant to wholesale purchasing and partnerships. */
const RELEVANT_ROLE_TERMS = [
  'owner',
  'founder',
  'managing director',
  'general manager',
  'purchasing',
  'procurement',
  'category manager',
  'buyer',
  'head of retail',
  'commercial',
  'operations',
  'e-commerce',
  'ecommerce',
  'merchandising',
  'practice manager',
  'inventory',
  'supply',
];

export interface ExtractedContact {
  fullName: string;
  roleTitle: string;
  /** The indexed profile URL when the result points at one. */
  profileUrl: string | null;
  sourceUrl: string;
  sourceTitle: string;
  /** Why this role matters for wholesale, in words. */
  roleRelevance: string;
}

function isProfileHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}

function plausiblePersonName(candidate: string): boolean {
  const words = candidate.trim().split(/\s+/);
  if (words.length < 2 || words.length > 5) return false;
  // Every word starts with an uppercase letter (incl. Dr, Al-, bin …).
  return words.every((word) => /^[A-Z]/.test(word.replace(/^Dr\.?$/i, 'Dr')));
}

function relevance(role: string): string | null {
  const lowered = role.toLowerCase();
  const matched = RELEVANT_ROLE_TERMS.find((term) => lowered.includes(term));
  if (!matched) return null;
  return `Role names ${matched} responsibility, which typically holds or influences the buying decision.`;
}

/**
 * Extracts at most one contact from one search result, for one account.
 *
 * The title must parse as "Name – Role – Company [| Site]" with the
 * company matching the account (by normalised containment either way), the
 * name must look like a person, and the role must be wholesale-relevant.
 * Anything less produces nothing.
 */
export function contactFromResult(
  result: SearchResult,
  accountNormalizedName: string,
): ExtractedContact | null {
  // Strip the trailing "| Site" segment first.
  const withoutSite = result.title.split(/\s+\|\s+/)[0] ?? '';
  const segments = withoutSite.split(/\s+[–—-]\s+/).map((segment) => segment.trim());
  if (segments.length < 3) return null;

  const [name, role, ...companyParts] = segments;
  const company = companyParts.join(' ');
  if (!name || !role || !company) return null;
  if (!plausiblePersonName(name)) return null;

  const companyNorm = normalizeAccountName(company);
  if (
    !companyNorm.includes(accountNormalizedName) &&
    !accountNormalizedName.includes(companyNorm)
  ) {
    return null;
  }

  const roleRelevance = relevance(role);
  if (!roleRelevance) return null;

  return {
    fullName: name,
    roleTitle: role,
    profileUrl: isProfileHost(result.url) ? result.url : null,
    sourceUrl: result.url,
    sourceTitle: result.title,
    roleRelevance,
  };
}
