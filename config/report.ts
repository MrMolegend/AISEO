/**
 * The one product, and everything it is allowed to cost.
 *
 * There is a single research product now, so there is no catalogue to look a
 * price up in — but the reason the old catalogue existed still holds: a cost
 * the client can influence is a cost the client can forge. Nothing here may be
 * sent by the browser. A submission says "run a market-entry report"; the
 * server says what that costs and how much work it may do.
 *
 * The budgets are equally load-bearing. They bound the search provider, the
 * retrieval pass and the model, so "how expensive can one report get" has an
 * answer you can read rather than estimate.
 */

import { BRAND } from './brand';

/** The only package id a customer can produce. */
export const MARKET_ENTRY_PACKAGE_ID = 'market-entry' as const;
export type MarketEntryPackageId = typeof MARKET_ENTRY_PACKAGE_ID;

/**
 * What one report costs the internal ledger.
 *
 * A hundred existing tokens, unchanged from the package this replaces, so that
 * balances granted before the transformation still buy exactly what they were
 * granted to buy. The customer never sees this number — see `formatCredits`.
 */
export const REPORT_TOKEN_COST = 100;

/** How many reports a token balance can pay for. Never shown as tokens. */
export function creditsFrom(tokens: number): number {
  return Math.floor(Math.max(0, tokens) / REPORT_TOKEN_COST);
}

/** The customer-facing rendering of a balance. Never "100 tokens". */
export function formatCredits(tokens: number): string {
  const credits = creditsFrom(tokens);
  return `${credits} ${credits === 1 ? BRAND.credit.singular : BRAND.credit.plural}`;
}

/**
 * The search budget, enforced server-side by lib/research/budget.ts.
 *
 * Advanced searches cost several times a basic one at the provider, so they are
 * spent on the three questions where breadth genuinely pays: what the target
 * market looks like, what the rules are, and who moves goods through it.
 */
export const SEARCH_BUDGET = {
  /** Broad, high-value discovery. */
  advanced: 3,
  /** Focused follow-ups. */
  basic: 9,
  /** Hard ceiling regardless of how the plan is composed. */
  total: 12,
} as const;

/** Upper bound on results asked for per query. The provider clamps again. */
export const MAX_RESULTS_PER_SEARCH = 10;

/**
 * Direct retrieval of independently discovered sources.
 *
 * This is enrichment, never a dependency. The budget exists to bound cost and
 * latency; exhausting it, or failing every fetch inside it, is a normal outcome
 * that a report continues past. See lib/research/retrieve.ts.
 */
export const RETRIEVAL_BUDGET = {
  maxFetches: 8,
  maxTotalBytes: 8 * 1024 * 1024,
  maxDurationMs: 45_000,
  /** Never more than this many pages from one publisher. */
  maxPerPublisher: 2,
  concurrency: 3,
} as const;

/** Distinct URLs that may enter the source registry for one report. */
export const MAX_SOURCES = 90;

/** Synthesis ceilings. */
export const SYNTHESIS_BUDGET = {
  maxContextChars: 180_000,
  maxOutputTokens: 16_000,
  /** Deliberately one. A second repair has never been the difference. */
  maxRepairAttempts: 1,
} as const;

/** Wall-clock ceiling for a whole job, including every stage. */
export const JOB_BUDGET_MS = 240_000;

/**
 * Quality-gate thresholds.
 *
 * Tuned so the gate catches a report with nothing in it rather than a report
 * with one honest gap. Every conditional threshold — the regulatory one
 * especially — only applies when the report actually makes the kind of claim
 * it governs. See lib/market-entry/quality-gate.ts.
 */
export const QUALITY_THRESHOLDS = {
  /** Unique credible sources across the whole dossier. */
  minSources: 8,
  /** Distinct publishers, so eight pages from one site is not eight sources. */
  minIndependentPublishers: 2,
  /**
   * Official, regulatory or recognised trade sources — required only when the
   * report asserts regulatory requirements as fact. A report that could not
   * reach an authority says so instead, and passes.
   */
  minAuthoritativeForRegulatoryClaims: 2,
  /** Competitors or substitutes, where the market reasonably supports them. */
  minCompetitors: 3,
} as const;

/** Typical wall-clock, shown before confirmation. Guidance, not a promise. */
export const TYPICAL_DURATION_MINUTES: readonly [number, number] = [3, 8];

/**
 * Load-time guard.
 *
 * These numbers are read in four different files and a mistake in any of them
 * is a cost incident rather than a crash. Failing at import turns it into a
 * failure nobody can deploy past.
 */
function assertBudgetsAreSane(): void {
  if (!Number.isInteger(REPORT_TOKEN_COST) || REPORT_TOKEN_COST <= 0) {
    throw new Error('REPORT_TOKEN_COST must be a positive integer');
  }
  if (SEARCH_BUDGET.advanced + SEARCH_BUDGET.basic > SEARCH_BUDGET.total) {
    throw new Error(
      `Search budget is incoherent: ${SEARCH_BUDGET.advanced} advanced + ` +
        `${SEARCH_BUDGET.basic} basic exceeds the hard total of ${SEARCH_BUDGET.total}`,
    );
  }
  if (SYNTHESIS_BUDGET.maxRepairAttempts < 0 || SYNTHESIS_BUDGET.maxRepairAttempts > 1) {
    throw new Error('At most one repair attempt is permitted');
  }
  if (RETRIEVAL_BUDGET.maxPerPublisher > RETRIEVAL_BUDGET.maxFetches) {
    throw new Error('A single publisher may not exceed the whole retrieval budget');
  }
  if (QUALITY_THRESHOLDS.minIndependentPublishers > QUALITY_THRESHOLDS.minSources) {
    throw new Error('More independent publishers required than sources');
  }
}

assertBudgetsAreSane();
