import type { MarketEntryReport } from '@/schemas/market-entry/report';

/**
 * Deterministic comparison of two report versions.
 *
 * No model is involved and none is needed: both reports are structured data,
 * so what changed between them is a computation, not an interpretation. An
 * LLM asked to "diff" two reports would paraphrase, drop the small changes
 * and occasionally invent one; this produces the same answer for the same
 * pair of inputs every time, and every line of it is checkable against the
 * two documents.
 *
 * Identity for list items is the id the report gave them (risks, regulatory
 * requirements, plan actions), falling back to a normalised title where ids
 * are absent. A "changed" entry names the fields that differ rather than
 * describing them — the UI renders both versions side by side, so the
 * comparison's job is to say where to look.
 */

export interface ScalarChange<T> {
  before: T;
  after: T;
  changed: boolean;
}

export interface NumberChange {
  before: number;
  after: number;
  delta: number;
}

export interface FactorChange {
  id: string;
  label: string;
  /** 0–1 scores as stored on the decision's factor list. */
  before: number | null;
  after: number | null;
  delta: number | null;
}

export interface ItemSummary {
  id: string;
  title: string;
}

export interface ChangedItem extends ItemSummary {
  /** Field names that differ between the versions. */
  fields: string[];
}

export interface ListDiff {
  added: ItemSummary[];
  removed: ItemSummary[];
  changed: ChangedItem[];
  unchanged: number;
}

export interface ClaimChange {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface VersionComparison {
  verdict: ScalarChange<string>;
  confidence: ScalarChange<string>;
  readiness: NumberChange;
  factors: FactorChange[];
  headlineClaims: ClaimChange[];
  risks: ListDiff;
  regulation: ListDiff;
  planActions: ListDiff;
  scenarios: {
    id: string;
    label: string;
    marginPercent: { before: number | null; after: number | null };
  }[];
  coverage: { field: string; label: string; before: number; after: number }[];
  limitations: { before: number; after: number };
}

function normalisedKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface Identified {
  id?: string;
  title: string;
}

function keyOf(item: Identified): string {
  return item.id ?? `title:${normalisedKey(item.title)}`;
}

/**
 * Generic keyed list diff. `fieldsOf` extracts the comparable fields whose
 * inequality marks an item as changed.
 */
function diffList<T extends Identified>(
  before: readonly T[],
  after: readonly T[],
  fieldsOf: (item: T) => Record<string, unknown>,
): ListDiff {
  const beforeByKey = new Map(before.map((item) => [keyOf(item), item]));
  const afterByKey = new Map(after.map((item) => [keyOf(item), item]));

  const added: ItemSummary[] = [];
  const removed: ItemSummary[] = [];
  const changed: ChangedItem[] = [];
  let unchanged = 0;

  for (const [key, item] of afterByKey) {
    const previous = beforeByKey.get(key);
    if (!previous) {
      added.push({ id: keyOf(item), title: item.title });
      continue;
    }
    const beforeFields = fieldsOf(previous);
    const afterFields = fieldsOf(item);
    const differing = Object.keys(afterFields).filter(
      (field) =>
        JSON.stringify(afterFields[field]) !== JSON.stringify(beforeFields[field]),
    );
    if (differing.length > 0) {
      changed.push({ id: keyOf(item), title: item.title, fields: differing });
    } else {
      unchanged += 1;
    }
  }

  for (const [key, item] of beforeByKey) {
    if (!afterByKey.has(key)) {
      removed.push({ id: keyOf(item), title: item.title });
    }
  }

  return { added, removed, changed, unchanged };
}

export function compareReports(
  before: MarketEntryReport,
  after: MarketEntryReport,
): VersionComparison {
  const factorIds = new Map<string, { label: string }>();
  for (const factor of before.decision.factors) factorIds.set(factor.id, factor);
  for (const factor of after.decision.factors) {
    if (!factorIds.has(factor.id)) factorIds.set(factor.id, factor);
  }

  const factors: FactorChange[] = [...factorIds.entries()].map(([id, { label }]) => {
    const b = before.decision.factors.find((factor) => factor.id === id)?.score ?? null;
    const a = after.decision.factors.find((factor) => factor.id === id)?.score ?? null;
    return {
      id,
      label,
      before: b,
      after: a,
      delta: b !== null && a !== null ? Number((a - b).toFixed(3)) : null,
    };
  });

  const headline = (
    label: string,
    b: { statement: string },
    a: { statement: string },
  ): ClaimChange => ({
    label,
    before: b.statement,
    after: a.statement,
    changed: normalisedKey(b.statement) !== normalisedKey(a.statement),
  });

  const scenarioIds = ['at-current-price', 'at-target-price', 'at-benchmark-midpoint'];

  const coverageFields: { field: keyof MarketEntryReport['coverage']; label: string }[] =
    [
      { field: 'sourcesAccepted', label: 'Sources consulted' },
      { field: 'directlyRetrieved', label: 'Read directly' },
      { field: 'authoritative', label: 'Authoritative sources' },
      { field: 'distinctPublishers', label: 'Distinct publishers' },
    ];

  return {
    verdict: {
      before: before.decision.verdict,
      after: after.decision.verdict,
      changed: before.decision.verdict !== after.decision.verdict,
    },
    confidence: {
      before: before.decision.confidence,
      after: after.decision.confidence,
      changed: before.decision.confidence !== after.decision.confidence,
    },
    readiness: {
      before: before.decision.readiness,
      after: after.decision.readiness,
      delta: after.decision.readiness - before.decision.readiness,
    },
    factors,
    headlineClaims: [
      headline(
        'Market attractiveness',
        before.executive.attractiveness,
        after.executive.attractiveness,
      ),
      headline(
        'Strongest opportunity',
        before.executive.strongestOpportunity,
        after.executive.strongestOpportunity,
      ),
      headline(
        'Largest obstacle',
        before.executive.largestObstacle,
        after.executive.largestObstacle,
      ),
    ],
    risks: diffList(before.risks, after.risks, (risk) => ({
      probability: risk.probability,
      impact: risk.impact,
      mitigation: risk.mitigation,
      confidence: risk.confidence,
    })),
    regulation: diffList(
      before.regulation.requirements,
      after.regulation.requirements,
      (requirement) => ({
        area: requirement.area,
        detail: requirement.detail,
        verifyWith: requirement.verifyWith,
        confidence: requirement.confidence,
      }),
    ),
    planActions: diffList(before.plan.actions, after.plan.actions, (action) => ({
      phase: action.phase,
      priority: action.priority,
      owner: action.owner,
      expectedOutcome: action.expectedOutcome,
    })),
    scenarios: scenarioIds.flatMap((id) => {
      const b = before.scenarios.find((scenario) => scenario.id === id);
      const a = after.scenarios.find((scenario) => scenario.id === id);
      if (!b && !a) return [];
      return [
        {
          id,
          label: a?.label ?? b?.label ?? id,
          marginPercent: {
            before: b?.grossMarginPercent ?? null,
            after: a?.grossMarginPercent ?? null,
          },
        },
      ];
    }),
    coverage: coverageFields.map(({ field, label }) => ({
      field,
      label,
      before: before.coverage[field] as number,
      after: after.coverage[field] as number,
    })),
    limitations: {
      before: before.appendix.limitations.length,
      after: after.appendix.limitations.length,
    },
  };
}

/** True when the comparison contains any change worth showing. */
export function comparisonHasChanges(comparison: VersionComparison): boolean {
  return (
    comparison.verdict.changed ||
    comparison.confidence.changed ||
    comparison.readiness.delta !== 0 ||
    comparison.headlineClaims.some((claim) => claim.changed) ||
    [comparison.risks, comparison.regulation, comparison.planActions].some(
      (diff) => diff.added.length + diff.removed.length + diff.changed.length > 0,
    )
  );
}
