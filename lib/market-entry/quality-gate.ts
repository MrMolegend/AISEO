import { QUALITY_THRESHOLDS } from '@/config/report';
import { isAuthoritative, isCredible } from '@/schemas/market-entry/evidence';
import type { MarketSource } from '@/schemas/market-entry/report';
import type { ModelReport } from '@/schemas/market-entry/report';

export interface GateOutcome {
  ok: boolean;
  /** Customer-readable reasons. Empty when the gate passes. */
  reasons: string[];
  /** For the observability record only. Never rendered. */
  measured: {
    credibleSources: number;
    distinctPublishers: number;
    authoritativeSources: number;
    directSources: number;
    competitors: number;
    assertsRegulation: boolean;
  };
}

/**
 * Is this report worth charging for?
 *
 * The gate exists to catch a report with nothing in it — not a report with an
 * honest gap. That distinction runs through every check below, and getting it
 * backwards would be worse than having no gate at all: a gate that fires
 * whenever one source was slow refunds constantly, teaches customers the
 * product does not work, and costs us the research we already paid for.
 *
 * So each conditional threshold applies only when the report actually makes the
 * kind of claim it governs. In particular, the regulatory check applies only to
 * a report that **asserts** regulatory requirements. A report that could not
 * reach an authority does not assert them — the validator has already demoted
 * those claims to unverified and the gaps are stated — so the check does not
 * apply, and an otherwise useful report passes and is charged for normally.
 * One inaccessible page can never fail a report.
 */
export function evaluateQualityGate(input: {
  report: ModelReport;
  sources: readonly MarketSource[];
  /** True when the research provider was a fixture rather than a live service. */
  providerIsLive: boolean;
  /** True on a deployment real customers reach. */
  servesRealCustomers: boolean;
}): GateOutcome {
  const { report, sources } = input;

  const credible = sources.filter((source) => isCredible(source.category));
  const authoritative = sources.filter((source) => isAuthoritative(source.category));
  const direct = sources.filter((source) => source.retrievalMode === 'direct');
  const publishers = new Set(
    credible
      .map((source) => source.publisher)
      .filter((name): name is string => name !== null),
  );

  /*
   * Does the report assert regulatory requirements, or describe an absence?
   *
   * "Asserts" means at least one requirement whose evidence claims to be read
   * from somewhere — basis `measured` or `sourced`. A requirements list whose
   * every claim is inferred or unavailable is the report saying "we could not
   * establish this", which is exactly the honest outcome the gate must not
   * punish.
   */
  const assertsRegulation = report.regulation.requirements.some((requirement) =>
    requirement.evidence.some(
      (claim) => claim.basis === 'measured' || claim.basis === 'sourced',
    ),
  );

  const competitors = report.competitive.entries.filter((entry) =>
    [entry.productOverlap, entry.customerOverlap, entry.marketPresence].some(
      (claim) => claim.sources.length > 0,
    ),
  ).length;

  const reasons: string[] = [];

  if (credible.length < QUALITY_THRESHOLDS.minSources) {
    reasons.push(
      `Only ${credible.length} credible sources were found; a usable assessment needs at least ${QUALITY_THRESHOLDS.minSources}.`,
    );
  }

  if (publishers.size < QUALITY_THRESHOLDS.minIndependentPublishers) {
    reasons.push(
      `The evidence came from ${publishers.size === 1 ? 'a single publisher' : `${publishers.size} publishers`}; findings need corroboration from independent sources.`,
    );
  }

  if (
    assertsRegulation &&
    authoritative.length < QUALITY_THRESHOLDS.minAuthoritativeForRegulatoryClaims
  ) {
    reasons.push(
      'The report states regulatory requirements but could not reach enough official, regulatory or recognised trade sources to stand behind them.',
    );
  }

  if (
    report.competitive.entries.length > 0 &&
    competitors < QUALITY_THRESHOLDS.minCompetitors
  ) {
    // Conditional on the market supporting them: an empty competitor list with
    // a stated reason is a finding, while a list of unevidenced names is not.
    reasons.push(
      `Only ${competitors} competitors or substitutes could be backed by evidence; the report needs at least ${QUALITY_THRESHOLDS.minCompetitors} or an explanation of why the market has none.`,
    );
  }

  if (report.appendix.limitations.length === 0) {
    reasons.push('The report does not state what it could not establish.');
  }

  if (report.route.options.length < 2) {
    reasons.push('No route-to-market comparison was produced.');
  }

  /*
   * The mock-provider prohibition, scoped to production.
   *
   * In CI the fixture provider is the entire point — it is what lets the whole
   * pipeline run without a key or a network. On a deployment real customers
   * reach, a report built on fixtures is the most dangerous output this system
   * can produce, so it fails here. The job pipeline also refuses to start such
   * a job at all; this is the second of the two locks, not the only one.
   */
  if (input.servesRealCustomers && !input.providerIsLive) {
    reasons.push('The research was not carried out against live sources.');
  }

  return {
    ok: reasons.length === 0,
    reasons,
    measured: {
      credibleSources: credible.length,
      distinctPublishers: publishers.size,
      authoritativeSources: authoritative.length,
      directSources: direct.length,
      competitors,
      assertsRegulation,
    },
  };
}
