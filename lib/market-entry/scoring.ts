import type { z } from 'zod';
import type {
  decisionSchema,
  ModelReport,
  MarketSource,
} from '@/schemas/market-entry/report';
import type { Verdict } from '@/config/design';
import { isAuthoritative, isCredible } from '@/schemas/market-entry/evidence';

export type Decision = z.infer<typeof decisionSchema>;
export type ScoreFactor = Decision['factors'][number];

/**
 * The readiness model.
 *
 * A documented, deterministic function from a validated report to a number
 * between 0 and 100, and then to one of four verdicts. It exists because the
 * alternative — asking the model how ready the business is — produces a figure
 * that cannot be reproduced, cannot be argued with, and moves if you ask twice.
 * A customer who disagrees with 62 deserves to be able to see which factor they
 * disagree with; a customer who disagrees with a paragraph has nowhere to go.
 *
 * Every factor is a pure function of fields that have already passed validation
 * and grading. None of them reads prose. Each returns 0–1 and carries the
 * sentence shown to the customer beside it, so the explanation and the
 * arithmetic cannot drift apart.
 *
 * The weights are a judgement and are stated as one. They encode that evidence
 * quality and regulatory clarity matter more than anything the report concludes
 * — because a confident recommendation on thin evidence is the failure mode
 * this product exists to avoid, and it should score badly.
 */

export const SCORE_WEIGHTS = {
  evidenceDepth: 0.2,
  regulatoryClarity: 0.2,
  demandSignal: 0.15,
  routeFit: 0.15,
  riskLoad: 0.15,
  commercialViability: 0.1,
  /*
   * Deliberately the smallest weight.
   *
   * Knowing who you are competing against is table stakes for a report rather
   * than a reason to enter a market — a crowded market and an empty one can
   * both score full marks here, because the factor measures whether the
   * question was answered, not whether the answer was good. It carried 15% in
   * the first version of this model, which let "we found four competitors"
   * outweigh "the risk register is heavy", and that is the wrong trade.
   */
  competitiveClarity: 0.05,
} as const;

/** Verdict bands. Stated here so the boundary is one number, not a condition. */
export const VERDICT_BANDS = { promising: 70, conditional: 50 } as const;

/*
 * The weights must sum to one, or the score is not out of a hundred and the
 * bands above mean nothing. Checked at import because the failure is silent:
 * weights summing to 0.95 produce a readiness that can never reach 95, and
 * nothing anywhere would say so.
 */
{
  const total = Object.values(SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(total - 1) > 1e-9) {
    throw new Error(`Readiness weights sum to ${total}, not 1`);
  }
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** Linear ramp from 0 at `floor` to 1 at `target`. */
const ramp = (value: number, floor: number, target: number): number =>
  target <= floor
    ? value >= target
      ? 1
      : 0
    : clamp01((value - floor) / (target - floor));

function claimsIn(values: readonly { basis: string }[]): {
  read: number;
  total: number;
} {
  return {
    read: values.filter(
      (claim) => claim.basis === 'measured' || claim.basis === 'sourced',
    ).length,
    total: values.length,
  };
}

export function computeFactors(
  report: ModelReport,
  sources: readonly MarketSource[],
): ScoreFactor[] {
  const credible = sources.filter((source) => isCredible(source.category));
  const authoritative = sources.filter((source) => isAuthoritative(source.category));
  const direct = sources.filter((source) => source.retrievalMode === 'direct');
  const onTarget = sources.filter(
    (source) =>
      source.geographicRelevance === 'target-market' ||
      source.geographicRelevance === 'target-region',
  );

  /* ── Evidence depth ──────────────────────────────────────────────────────
     Volume alone is easy to fake with eight pages from one site, so this is the
     harmonic-ish combination of how many credible sources there are and how
     many of them we actually opened. */
  const evidenceDepth =
    0.5 * ramp(credible.length, 4, 16) + 0.5 * ramp(direct.length, 1, 6);

  /* ── Regulatory clarity ──────────────────────────────────────────────────
     Requirements that rest on an authority, minus the gaps the report itself
     admits to. A report with no requirements and no gaps scores mid: it has
     told us nothing either way. */
  const requirements = report.regulation.requirements;
  const backedRequirements = requirements.filter((requirement) =>
    requirement.evidence.some((claim) => claim.sources.length > 0),
  ).length;
  const regulatoryClarity =
    requirements.length === 0
      ? 0.35
      : clamp01(
          0.7 * (backedRequirements / requirements.length) +
            0.3 * ramp(authoritative.length, 0, 4) -
            0.05 * report.regulation.gaps.length,
        );

  /* ── Demand signal ───────────────────────────────────────────────────────
     Read evidence, not inference. A section full of confident reasoning with no
     citations is precisely what should not raise a readiness score. */
  const demand = claimsIn([
    ...report.marketSignals.demand,
    ...report.marketSignals.growth,
    ...report.marketSignals.customerBehaviour,
  ]);
  const demandSignal =
    demand.total === 0
      ? 0
      : clamp01(0.7 * (demand.read / demand.total) + 0.3 * ramp(onTarget.length, 1, 8));

  /* ── Competitive clarity ─────────────────────────────────────────────────
     Knowing who you are up against is a positive, even when the answer is
     crowded. Not knowing is the risk. */
  const evidenced = report.competitive.entries.filter((entry) =>
    [entry.productOverlap, entry.customerOverlap, entry.marketPresence].some(
      (claim) => claim.sources.length > 0,
    ),
  ).length;
  const competitiveClarity = ramp(evidenced, 0, 4);

  /* ── Route fit ───────────────────────────────────────────────────────────
     Is the recommended route supported by evidence, and does the comparison
     behind it have any breadth? */
  const primary = report.route.options.find(
    (option) => option.id === report.route.primary,
  );
  const primaryEvidence = primary ? claimsIn(primary.evidence) : { read: 0, total: 0 };
  const routeFit = clamp01(
    0.5 * (primary && primary.suitability === 'strong' ? 1 : primary ? 0.6 : 0) +
      0.3 * ramp(primaryEvidence.read, 0, 2) +
      0.2 * ramp(report.route.options.length, 2, 4),
  );

  /* ── Commercial viability ────────────────────────────────────────────────
     Deliberately measures whether the case can be *assessed*, not whether it is
     good. A business that supplied no figures has an unassessable commercial
     case, and that is a real reason to be less ready — but it is not the same
     as having bad numbers, and the explanation says so. */
  const pricingGaps = report.pricing.missingData.length;
  const benchmarks = claimsIn(report.pricing.researchedBenchmarks);
  const commercialViability = clamp01(
    0.6 * ramp(benchmarks.read, 0, 3) + 0.4 * (1 - ramp(pricingGaps, 0, 6)),
  );

  /* ── Risk load ───────────────────────────────────────────────────────────
     Inverted: a heavy register lowers readiness. Capped so that a thorough risk
     section is never worse for a business than a lazy one — the weight is 5%
     precisely because "found more risks" must not dominate the score. */
  const riskWeight = report.risks.reduce((total, risk) => {
    const probability =
      risk.probability === 'high' ? 3 : risk.probability === 'medium' ? 2 : 1;
    const impact = risk.impact === 'high' ? 3 : risk.impact === 'medium' ? 2 : 1;
    return total + probability * impact;
  }, 0);
  const riskLoad = 1 - ramp(riskWeight, 6, 40);

  return [
    {
      id: 'evidenceDepth',
      label: 'Evidence depth',
      weight: SCORE_WEIGHTS.evidenceDepth,
      score: clamp01(evidenceDepth),
      explanation: `${credible.length} credible sources, ${direct.length} of them read directly.`,
    },
    {
      id: 'regulatoryClarity',
      label: 'Regulatory clarity',
      weight: SCORE_WEIGHTS.regulatoryClarity,
      score: clamp01(regulatoryClarity),
      explanation:
        requirements.length === 0
          ? 'No regulatory requirements were established either way.'
          : `${backedRequirements} of ${requirements.length} requirements rest on a named authority; ${report.regulation.gaps.length} gaps remain.`,
    },
    {
      id: 'demandSignal',
      label: 'Demand signal',
      weight: SCORE_WEIGHTS.demandSignal,
      score: clamp01(demandSignal),
      explanation:
        demand.total === 0
          ? 'No demand evidence was found.'
          : `${demand.read} of ${demand.total} demand statements come from a source rather than from reasoning.`,
    },
    {
      id: 'competitiveClarity',
      label: 'Competitive clarity',
      weight: SCORE_WEIGHTS.competitiveClarity,
      score: clamp01(competitiveClarity),
      explanation: `${evidenced} competitors or substitutes are backed by evidence.`,
    },
    {
      id: 'routeFit',
      label: 'Route fit',
      weight: SCORE_WEIGHTS.routeFit,
      score: clamp01(routeFit),
      explanation: primary
        ? `The recommended route is rated ${primary.suitability} against ${report.route.options.length} compared routes.`
        : 'No primary route could be matched to the comparison.',
    },
    {
      id: 'commercialViability',
      label: 'Commercial assessability',
      weight: SCORE_WEIGHTS.commercialViability,
      score: clamp01(commercialViability),
      explanation: `${benchmarks.read} sourced price benchmarks; ${pricingGaps} commercial inputs still missing.`,
    },
    {
      id: 'riskLoad',
      label: 'Risk load',
      weight: SCORE_WEIGHTS.riskLoad,
      score: clamp01(riskLoad),
      explanation: `${report.risks.length} risks recorded, weighted by probability and impact.`,
    },
  ];
}

export function readinessFrom(factors: readonly ScoreFactor[]): number {
  const total = factors.reduce((sum, factor) => sum + factor.weight * factor.score, 0);
  return Math.round(clamp01(total) * 100);
}

export function verdictFrom(readiness: number): Verdict {
  if (readiness >= VERDICT_BANDS.promising) return 'promising';
  if (readiness >= VERDICT_BANDS.conditional) return 'promising-with-conditions';
  return 'high-risk';
}

/**
 * Overall confidence in the assessment itself.
 *
 * Not confidence that the venture will succeed — confidence that this document
 * is a sound basis for deciding. It therefore reads only the evidence factors,
 * because a well-evidenced "high risk" is a confident answer.
 */
export function confidenceFrom(
  factors: readonly ScoreFactor[],
): 'high' | 'medium' | 'low' {
  const evidence = factors.find((factor) => factor.id === 'evidenceDepth')?.score ?? 0;
  const regulatory =
    factors.find((factor) => factor.id === 'regulatoryClarity')?.score ?? 0;
  const combined = (evidence + regulatory) / 2;
  if (combined >= 0.7) return 'high';
  if (combined >= 0.45) return 'medium';
  return 'low';
}

export function buildDecision(input: {
  report: ModelReport;
  sources: readonly MarketSource[];
  businessName: string;
  productName: string;
  originCountry: string;
  targetCountry: string;
  targetRegion: string | null;
  researchedAt: string;
}): Decision {
  const factors = computeFactors(input.report, input.sources);
  const readiness = readinessFrom(factors);

  return {
    businessName: input.businessName,
    productName: input.productName,
    originCountry: input.originCountry,
    targetCountry: input.targetCountry,
    targetRegion: input.targetRegion,
    researchedAt: input.researchedAt,
    verdict: verdictFrom(readiness),
    confidence: confidenceFrom(factors),
    readiness,
    factors,
  };
}
