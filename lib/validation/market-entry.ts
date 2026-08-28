import type { ZodType } from 'zod';
import {
  deriveEvidenceGrade,
  isSensitivePath,
  CITATION_EXEMPT_BASES,
  type GradingSource,
  type MarketEntryBasis,
} from '@/schemas/market-entry/evidence';
import type { EvidenceGrade } from '@/config/design';
import type { ModelReport } from '@/schemas/market-entry/report';
import { sanitiseDeep, type SanitiseState } from './research';

/**
 * Validating a market-entry report.
 *
 * Four passes, in an order that matters:
 *
 *   1. Schema. Shape and length limits.
 *   2. Citations and list integrity. A citation to a source that does not
 *      exist, a plan action depending on an action that was never written, a
 *      recommended route that is not among the options compared.
 *   3. Grading and demotion. Every claim is labelled from its basis and the
 *      metadata of the sources it cites.
 *   4. Sanitisation.
 *
 * Passes 1 and 2 can fail the report into a repair round. Pass 3 **cannot**,
 * and that is the most important thing in this file.
 */

export const MAX_REPORTED_PROBLEMS = 12;

export interface Demotion {
  /** Dotted path of the claim, e.g. `regulation.requirements[0].evidence[0]`. */
  path: string;
  statement: string;
  reason: string;
}

export type MarketEntryValidation =
  | {
      ok: true;
      report: ModelReport;
      grades: Record<string, EvidenceGrade>;
      demotions: Demotion[];
      sanitizedFields: string[];
    }
  | { ok: false; problems: string[] };

/* ────────────────────────── Walking the claims ───────────────────────────── */

interface ClaimSite {
  path: string;
  basis: MarketEntryBasis;
  sources: string[];
  statement: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Finds every claim in the report, wherever it is nested.
 *
 * Structural rather than a list of known field paths, for the same reason the
 * sanitiser is: a claim in a section someone adds next month would otherwise be
 * ungraded and uncited, and it would look exactly like a graded one.
 */
export function collectClaims(report: unknown, path = ''): ClaimSite[] {
  const found: ClaimSite[] = [];

  const walk = (value: unknown, current: string): void => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => walk(entry, `${current}[${index}]`));
      return;
    }
    if (!isRecord(value)) return;

    if (typeof value.basis === 'string' && Array.isArray(value.sources)) {
      found.push({
        path: current || '(root)',
        basis: value.basis as MarketEntryBasis,
        sources: value.sources.filter((ref): ref is string => typeof ref === 'string'),
        statement:
          typeof value.statement === 'string'
            ? value.statement
            : typeof value.value === 'string'
              ? value.value
              : '',
      });
    }

    for (const [key, child] of Object.entries(value)) {
      if (key === 'sources') continue;
      walk(child, current ? `${current}.${key}` : key);
    }
  };

  walk(report, path);
  return found;
}

/* ──────────────────────── Pass 2: citations and lists ────────────────────── */

export function crossReferenceClaims(
  report: unknown,
  knownRefs: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];

  for (const claim of collectClaims(report)) {
    for (const ref of claim.sources) {
      if (!knownRefs.has(ref)) {
        problems.push(
          `${claim.path} cites ${ref}, which is not in the source list. Cite a real identifier or set the basis to "inferred".`,
        );
      }
    }

    if (claim.sources.length === 0 && !CITATION_EXEMPT_BASES.includes(claim.basis)) {
      problems.push(
        `${claim.path} declares basis "${claim.basis}" but cites no source. Cite one, or use "inferred", "provided", "modelled" or "unavailable".`,
      );
    }
  }

  return problems;
}

/**
 * Structural rules a schema cannot express.
 *
 * Each of these produces a report that parses perfectly and is wrong in a way a
 * reader would notice immediately: a plan whose first action depends on an
 * action that does not exist, a recommendation for a route that was never
 * compared, two competitors ranked third.
 */
export function checkStructure(report: ModelReport): string[] {
  const problems: string[] = [];

  const uniqueIds = (label: string, ids: readonly string[]): void => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) problems.push(`${label} contains a duplicate id: ${id}`);
      seen.add(id);
    }
  };

  const competitorIds = report.competitive.entries.map((entry) => entry.id);
  uniqueIds('competitive.entries', competitorIds);

  const ranks = report.competitive.entries
    .map((entry) => entry.rank)
    .sort((a, b) => a - b);
  ranks.forEach((rank, index) => {
    if (rank !== index + 1) {
      problems.push(
        `competitive.entries ranks must run 1..${ranks.length} with no gaps or duplicates.`,
      );
    }
  });

  uniqueIds(
    'customers.groups',
    report.customers.groups.map((group) => group.id),
  );
  uniqueIds(
    'risks',
    report.risks.map((risk) => risk.id),
  );

  const actionIds = report.plan.actions.map((action) => action.id);
  uniqueIds('plan.actions', actionIds);

  const actionIdSet = new Set(actionIds);
  for (const action of report.plan.actions) {
    if (action.dependsOn !== null && !actionIdSet.has(action.dependsOn)) {
      problems.push(
        `plan action "${action.id}" depends on "${action.dependsOn}", which is not an action in this plan.`,
      );
    }
    if (action.dependsOn === action.id) {
      problems.push(`plan action "${action.id}" depends on itself.`);
    }
  }

  const optionIds = new Set(report.route.options.map((option) => option.id));
  if (!optionIds.has(report.route.primary)) {
    problems.push(
      `route.primary is "${report.route.primary}", which is not among the routes compared.`,
    );
  }
  if (!optionIds.has(report.route.fallback)) {
    problems.push(
      `route.fallback is "${report.route.fallback}", which is not among the routes compared.`,
    );
  }
  if (report.route.primary === report.route.fallback) {
    problems.push('route.primary and route.fallback are the same route.');
  }

  // A series is the most authoritative-looking thing on the page, so it is held
  // to the strictest rule: every point sourced, or it does not render at all.
  report.marketSignals.series.forEach((series, index) => {
    for (const point of series.points) {
      if (!Number.isFinite(point.value)) {
        problems.push(`marketSignals.series[${index}] contains a non-numeric point.`);
        break;
      }
    }
  });

  return problems;
}

/* ─────────────────── Pass 3: grading, which never fails ──────────────────── */

/**
 * Labels every claim, and records the ones that could not reach "verified".
 *
 * **This pass cannot fail a report.** A regulatory claim whose only support is
 * an indexed summary is labelled unverified and its gap is recorded — it is not
 * deleted, not sent to a repair round, and not a reason to refuse the report.
 * An authority's website refusing our fetch is our problem to disclose, not the
 * customer's problem to be charged for twice.
 *
 * The claim's own text is left exactly as written. Rewriting its basis to
 * "unavailable" would be a second lie in the other direction: the information
 * was available, we simply could not open the page that had it, and those are
 * different things a reader deserves to be able to tell apart.
 */
export function gradeReport(
  report: ModelReport,
  sourcesByRef: ReadonlyMap<string, GradingSource>,
): { grades: Record<string, EvidenceGrade>; demotions: Demotion[] } {
  const grades: Record<string, EvidenceGrade> = {};
  const demotions: Demotion[] = [];

  for (const claim of collectClaims(report)) {
    const sensitive = isSensitivePath(claim.path);
    const cited = claim.sources
      .map((ref) => sourcesByRef.get(ref))
      .filter((source): source is GradingSource => source !== undefined);

    const grade = deriveEvidenceGrade({
      basis: claim.basis,
      sources: cited,
      sensitive,
    });

    grades[claim.path] = grade;

    const claimedFact = claim.basis === 'measured' || claim.basis === 'sourced';
    if (grade === 'unknown' && claimedFact) {
      demotions.push({
        path: claim.path,
        statement: claim.statement,
        reason: sensitive
          ? 'No directly retrieved authoritative source supports this, so it is shown as unverified.'
          : 'No credible source could be matched to this claim, so it is shown as unverified.',
      });
    }
  }

  return { grades, demotions };
}

/**
 * Turns demotions into the limitations a reader sees.
 *
 * Grouped by section rather than listed per claim: eleven separate lines saying
 * "a regulatory claim could not be verified" is noise, and the useful fact is
 * that the regulatory section as a whole is resting on less than it should.
 */
export function limitationsFromDemotions(
  demotions: readonly Demotion[],
): { area: string; detail: string; howToResolve: string | null }[] {
  if (demotions.length === 0) return [];

  const bySection = new Map<string, Demotion[]>();
  for (const demotion of demotions) {
    const section = demotion.path.split(/[.[]/)[0] ?? 'report';
    const bucket = bySection.get(section) ?? [];
    bucket.push(demotion);
    bySection.set(section, bucket);
  }

  const SECTION_LABEL: Record<string, string> = {
    regulation: 'Regulatory evidence',
    marketSignals: 'Market signals',
    pricing: 'Pricing evidence',
    competitive: 'Competitor evidence',
    customers: 'Buyer evidence',
    route: 'Route evidence',
    risks: 'Risk evidence',
  };

  return [...bySection.entries()].map(([section, claims]) => ({
    area: SECTION_LABEL[section] ?? 'Evidence',
    detail:
      claims.length === 1
        ? `One statement in this section could not be confirmed against a source we were able to read directly, and is shown as unverified.`
        : `${claims.length} statements in this section could not be confirmed against sources we were able to read directly, and are shown as unverified.`,
    howToResolve:
      'The pages behind these claims are usually readable in a browser. Follow the citations before acting on them.',
  }));
}

/* ─────────────────────────────── The whole ───────────────────────────────── */

export function validateMarketEntryReport(
  raw: unknown,
  schema: ZodType<ModelReport>,
  sourcesByRef: ReadonlyMap<string, GradingSource>,
): MarketEntryValidation {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      problems: parsed.error.issues
        .slice(0, MAX_REPORTED_PROBLEMS)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    };
  }

  const knownRefs = new Set(sourcesByRef.keys());
  const problems = [
    ...crossReferenceClaims(parsed.data, knownRefs),
    ...checkStructure(parsed.data),
  ];

  if (problems.length > 0) {
    return { ok: false, problems: problems.slice(0, MAX_REPORTED_PROBLEMS) };
  }

  // Sanitisation last, deliberately. A scrubbed string must not be able to turn
  // a failing report into a passing one.
  const state: SanitiseState = { fields: [] };
  const clean = sanitiseDeep(parsed.data, '', state) as ModelReport;

  const { grades, demotions } = gradeReport(clean, sourcesByRef);

  return { ok: true, report: clean, grades, demotions, sanitizedFields: state.fields };
}
