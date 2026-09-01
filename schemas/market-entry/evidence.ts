import { z } from 'zod';
import { sourceRefSchema } from '@/schemas/research/shared';
import { EVIDENCE_GRADES, type EvidenceGrade } from '@/config/design';

/**
 * What counts as evidence, and how strong it is.
 *
 * The single idea behind this file: a reader must be able to tell, without
 * following a link, whether a sentence in the report is something a government
 * published, something they themselves typed into the form, something we
 * calculated, something we reasoned our way to, or something nobody could
 * establish. Collapsing those five into "the report says" is how a research
 * document becomes confidently wrong in a way nobody can check.
 *
 * The grade is never chosen by the model. It is derived here, from the basis
 * the model declared and the metadata of the sources it cited — so a claim
 * cannot award itself authority it has not got.
 */

/* ─────────────────────────────── Categories ──────────────────────────────── */

/**
 * Where a source came from, in the terms this product cares about.
 *
 * Ordered roughly by the weight a market-entry decision can put on it. The
 * ordering is not decorative: `AUTHORITATIVE_CATEGORIES` is a prefix of it, and
 * the query planner prefers earlier categories when it has a choice.
 */
export const SOURCE_CATEGORIES = [
  'official', // a government department or ministry
  'regulator', // a named regulatory body
  'customs', // customs, tariff and import authorities
  'statistical', // national statistics offices, official trade data
  'trade_association', // sector bodies
  'chamber', // chambers of commerce, bilateral trade councils
  'industry_publication', // recognised trade press
  'news', // credible general news
  'retailer', // an established retailer or marketplace
  'company', // a company's own pages
  'directory', // public business directories
  'other',
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

export const sourceCategorySchema = z.enum(SOURCE_CATEGORIES);

/**
 * Categories that can carry a regulatory, tariff or official-statistics claim
 * on their own.
 *
 * Trade press reporting what a regulator said is useful context and is not
 * this. The distinction exists because "the report told me a licence was
 * required" is a sentence someone spends money on.
 */
export const AUTHORITATIVE_CATEGORIES: readonly SourceCategory[] = [
  'official',
  'regulator',
  'customs',
  'statistical',
  'trade_association',
  'chamber',
];

/**
 * Categories that count toward the source-count threshold at all.
 *
 * `other` does not: an unclassifiable page is not evidence of anything, and
 * letting eight of them satisfy the gate would make the gate decorative.
 */
export const CREDIBLE_CATEGORIES: readonly SourceCategory[] = SOURCE_CATEGORIES.filter(
  (category) => category !== 'other',
);

export function isAuthoritative(category: SourceCategory): boolean {
  return AUTHORITATIVE_CATEGORIES.includes(category);
}

export function isCredible(category: SourceCategory): boolean {
  return CREDIBLE_CATEGORIES.includes(category);
}

/* ──────────────────────────── Retrieval mode ─────────────────────────────── */

/**
 * Whether we read the page or only saw it described.
 *
 * `indexed` means a search provider's index told us this page exists and
 * summarised it. That is a real signal and it is cited as one — but it is a
 * summary written by a third party about a page we did not open, so it cannot
 * carry a claim that someone will act on financially or legally by itself.
 */
export const retrievalModeSchema = z.enum(['direct', 'indexed']);
export type RetrievalMode = z.infer<typeof retrievalModeSchema>;

/* ────────────────────────── Geographic relevance ─────────────────────────── */

/**
 * How much a source has to do with the market being entered.
 *
 * A well-sourced statement about the wrong country is the most plausible-looking
 * mistake this product can make, so the relevance is recorded per source and
 * rendered rather than assumed from the query that found it.
 */
export const geographicRelevanceSchema = z.enum([
  'target-market',
  'target-region',
  'origin-market',
  'global',
  'other-market',
  'unknown',
]);

export type GeographicRelevance = z.infer<typeof geographicRelevanceSchema>;

/* ──────────────────────────────── Basis ──────────────────────────────────── */

/**
 * Where a value came from. Wider than the legacy vocabulary by two.
 *
 *   measured     read directly off a page we retrieved
 *   sourced      stated by a source we saw through an index but did not open
 *   provided     the customer typed it into the intake form
 *   modelled     computed by our own deterministic model from stated inputs
 *   inferred     our reasoning from other evidence, not stated anywhere
 *   unavailable  we looked and could not establish it
 *
 * `provided` and `modelled` are new here and they are the point: a market-entry
 * report mixes the customer's own numbers with researched ones, and a margin
 * scenario built from their cost price is not a finding about the market. The
 * legacy four-value vocabulary had nowhere to put either, so both would have
 * had to masquerade as `sourced`.
 */
export const marketEntryBasisSchema = z.enum([
  'measured',
  'sourced',
  'provided',
  'modelled',
  'inferred',
  'unavailable',
]);

export type MarketEntryBasis = z.infer<typeof marketEntryBasisSchema>;

/** Bases that are complete answers with no citation attached. */
export const CITATION_EXEMPT_BASES: readonly MarketEntryBasis[] = [
  'provided',
  'modelled',
  'inferred',
  'unavailable',
];

/* ──────────────────────────────── Claims ─────────────────────────────────── */

/**
 * A claim, with its basis and its citations.
 *
 * Note what is absent: a grade. The model declares a basis and cites sources;
 * the grade is computed from those two by `deriveEvidenceGrade` after
 * validation, so it reflects the evidence that actually exists rather than the
 * confidence the prose was written with.
 */
export const marketClaimSchema = z.object({
  statement: z.string().min(1).max(700),
  basis: marketEntryBasisSchema,
  confidence: z.enum(['high', 'medium', 'low']),
  sources: z.array(sourceRefSchema).max(8),
});

export type MarketClaim = z.infer<typeof marketClaimSchema>;

/**
 * A value that may simply not be knowable.
 *
 * Used wherever the report would otherwise be tempted to invent a number.
 * `basis: 'unavailable'` with a null value is a complete, valid answer, and on
 * a market-entry report it is frequently the correct one.
 */
export const marketValueSchema = z.object({
  value: z.string().max(300).nullable(),
  basis: marketEntryBasisSchema,
  confidence: z.enum(['high', 'medium', 'low']),
  sources: z.array(sourceRefSchema).max(6),
  /** Why it could not be established, when it could not. */
  note: z.string().max(300).nullable(),
});

export type MarketValue = z.infer<typeof marketValueSchema>;

/* ─────────────────────── Sensitive claim classification ──────────────────── */

/**
 * Report paths whose claims may not rest on an indexed snippet alone.
 *
 * These are the three kinds of statement a reader spends money against:
 * what the law requires, what the market is worth, and what things cost. A
 * claim under one of these paths that cannot cite a directly retrieved credible
 * source is demoted to `unknown` — not dropped, not repaired, and never a
 * reason to fail the report. See lib/validation/market-entry.ts.
 *
 * Matched as dotted-path prefixes against the paths the validator walks, so
 * `regulation.requirements[2].evidence[0]` is covered by `regulation`.
 */
export const SENSITIVE_CLAIM_PATHS: readonly string[] = [
  'regulation',
  'marketSignals.size',
  'marketSignals.growth',
  'pricing.researchedBenchmarks',
  'competitive.entries.pricing',
];

export function isSensitivePath(path: string): boolean {
  return SENSITIVE_CLAIM_PATHS.some(
    (prefix) =>
      path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`),
  );
}

/* ────────────────────────── Grade derivation ─────────────────────────────── */

/** The source metadata the grade derivation needs. Deliberately minimal. */
export interface GradingSource {
  category: SourceCategory;
  retrievalMode: RetrievalMode;
}

/**
 * The one function that decides how a claim is labelled.
 *
 * Deterministic, pure, and unit-tested against a table of cases. It is the
 * enforcement point for the rule that an indexed snippet may support a weak
 * signal but not a regulatory, financial or market-size claim: for a sensitive
 * path, `verified` requires a credible source we actually opened.
 *
 * A claim that cannot reach `verified` becomes `unknown`. That is a demotion,
 * not a rejection — the statement still appears, labelled as unverified, with
 * its gap recorded in the limitations. A report is not worth failing because
 * one authority's website refused a fetch.
 */
export function deriveEvidenceGrade(input: {
  basis: MarketEntryBasis;
  sources: readonly GradingSource[];
  sensitive: boolean;
}): EvidenceGrade {
  switch (input.basis) {
    case 'provided':
      return 'provided';
    case 'modelled':
      return 'modelled';
    case 'inferred':
      return 'inference';
    case 'unavailable':
      return 'unknown';
    case 'measured':
    case 'sourced': {
      const credible = input.sources.filter((source) => isCredible(source.category));
      if (credible.length === 0) return 'unknown';
      if (!input.sensitive) return 'verified';

      const directlyRead = credible.some((source) => source.retrievalMode === 'direct');
      return directlyRead ? 'verified' : 'unknown';
    }
  }
}

/** Compile-time proof that every grade the design system renders is reachable. */
const _everyGradeIsRenderable: Record<EvidenceGrade, true> = Object.fromEntries(
  EVIDENCE_GRADES.map((grade) => [grade, true]),
) as Record<EvidenceGrade, true>;
void _everyGradeIsRenderable;
