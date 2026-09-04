import type { EvidenceRef } from '@/lib/outreach/generate';

/**
 * The unsupported-claim detector — pure, and run at approval time, after
 * any human edits.
 *
 * Three families of violation:
 *
 *   fabricated_familiarity  Phrases that claim contact, memory or
 *                           observation the evidence does not hold
 *                           ("I saw your post", "we met", "as discussed").
 *   prohibited_claim        Text matching an entry on the configured
 *                           prohibited-claims list.
 *   unsupported_number      A figure (percent, currency, count claims)
 *                           that appears in the body but in none of the
 *                           draft's evidence texts. Numbers are where
 *                           invented facts do the most damage.
 *
 * The linter cannot prove a sentence true; it can prove a draft makes a
 * class of claim its evidence cannot back, and approval is refused until
 * a person removes or supports it.
 */

export interface LintViolation {
  kind: 'fabricated_familiarity' | 'prohibited_claim' | 'unsupported_number';
  excerpt: string;
  message: string;
}

const FAMILIARITY_PATTERNS: { pattern: RegExp; label: string }[] = [
  {
    pattern: /\bI (?:just )?saw your (?:post|article|announcement)/i,
    label: 'claims to have seen a post',
  },
  {
    pattern: /\bwe (?:met|spoke|talked)\b/i,
    label: 'claims a previous meeting or conversation',
  },
  { pattern: /\bas (?:we )?discussed\b/i, label: 'claims a previous discussion' },
  { pattern: /\bgreat to (?:meet|see) you\b/i, label: 'claims a previous meeting' },
  {
    pattern: /\bmutual (?:friend|contact|connection)\b/i,
    label: 'claims a mutual contact',
  },
  { pattern: /\bcongratulations on\b/i, label: 'claims knowledge of a recent event' },
  {
    pattern: /\bI noticed you(?:r team)? (?:recently|just)\b/i,
    label: 'claims a recent observation',
  },
  { pattern: /\bbig fan of\b/i, label: 'claims personal familiarity' },
];

/** Digit-bearing tokens worth checking: percentages, currency, bare counts ≥ 2 digits. */
const NUMBER_TOKEN =
  /\d[\d,.]*\s*(?:%|percent|AED|USD|SAR|QAR|dirhams?)|(?<![\w.])\d{2,}(?![\w%])/gi;

export function lintDraft(
  body: string,
  evidenceRefs: EvidenceRef[],
  prohibitedClaims: { text: string }[],
): LintViolation[] {
  const violations: LintViolation[] = [];

  for (const { pattern, label } of FAMILIARITY_PATTERNS) {
    const match = body.match(pattern);
    if (match) {
      violations.push({
        kind: 'fabricated_familiarity',
        excerpt: match[0],
        message: `The draft ${label}; nothing in its evidence supports that. Remove it, or ground it in a stored claim first.`,
      });
    }
  }

  const lowered = body.toLowerCase();
  for (const claim of prohibitedClaims) {
    const needle = claim.text.trim().toLowerCase();
    if (needle.length >= 8 && lowered.includes(needle)) {
      violations.push({
        kind: 'prohibited_claim',
        excerpt: claim.text,
        message: 'This claim is on the prohibited list and may not appear in outreach.',
      });
    }
  }

  const evidenceText = evidenceRefs
    .map((ref) => ref.text)
    .join(' ')
    .toLowerCase();
  for (const match of body.matchAll(NUMBER_TOKEN)) {
    const token = match[0].trim();
    const digits = token.replace(/[^\d]/g, '');
    // Years read as dates, not claims; short counts inside evidence pass.
    if (digits.length === 4 && digits.startsWith('20')) continue;
    if (evidenceText.includes(digits)) continue;
    violations.push({
      kind: 'unsupported_number',
      excerpt: token,
      message: `The figure “${token}” appears in no evidence attached to this draft. Numbers need sources.`,
    });
  }

  return violations;
}
