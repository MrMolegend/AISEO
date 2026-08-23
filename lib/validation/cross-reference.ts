import {
  type AuditAnalysis,
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  type Category,
} from '@/schemas/audit';

/**
 * Rules a JSON Schema cannot express.
 *
 * Zod guarantees the *shape* of the analysis. These checks guarantee its
 * *coherence*: that a top priority points at an issue that actually exists, that a
 * critical finding carries evidence, that no id is reused. A model can produce
 * perfectly-shaped nonsense; this is what catches it.
 *
 * Failures are returned rather than thrown so the repair pass can feed the exact
 * rule names back to the model.
 */

export interface CrossReferenceIssue {
  rule: string;
  message: string;
}

export function crossReferenceAnalysis(analysis: AuditAnalysis): CrossReferenceIssue[] {
  const problems: CrossReferenceIssue[] = [];
  const issueIds = new Set(analysis.issues.map((i) => i.id));

  const fail = (rule: string, message: string) => problems.push({ rule, message });

  /* ── Unique ids within each collection ─────────────────────────────── */
  const collections: [string, { id: string }[]][] = [
    ['issues', analysis.issues],
    ['strengths', analysis.strengths],
    ['opportunities', analysis.opportunities],
    ['limitations', analysis.limitations],
    [
      'actionPlan',
      [
        ...analysis.actionPlan.immediate,
        ...analysis.actionPlan.next30Days,
        ...analysis.actionPlan.next90Days,
      ],
    ],
  ];

  for (const [name, items] of collections) {
    const seen = new Set<string>();
    for (const item of items) {
      if (seen.has(item.id)) {
        fail('unique-ids', `${name} contains duplicate id "${item.id}".`);
      }
      seen.add(item.id);
    }
  }

  /* ── topPriorities reference real issues, ranks are 1..n contiguous ── */
  for (const priority of analysis.topPriorities) {
    if (!issueIds.has(priority.issueId)) {
      fail(
        'priority-references-issue',
        `topPriorities rank ${priority.rank} references issueId "${priority.issueId}", which is not in issues[].`,
      );
    }
  }

  const ranks = analysis.topPriorities.map((p) => p.rank).sort((a, b) => a - b);
  const expected = Array.from({ length: ranks.length }, (_, i) => i + 1);
  if (ranks.join(',') !== expected.join(',')) {
    fail(
      'contiguous-ranks',
      `topPriorities ranks must be ${expected.join(', ')} with no gaps or duplicates; got ${ranks.join(', ')}.`,
    );
  }

  /* ── actionPlan items reference real issues ────────────────────────── */
  const phases = [
    ['immediate', analysis.actionPlan.immediate],
    ['next30Days', analysis.actionPlan.next30Days],
    ['next90Days', analysis.actionPlan.next90Days],
  ] as const;

  for (const [phase, items] of phases) {
    for (const item of items) {
      for (const id of item.issueIds) {
        if (!issueIds.has(id)) {
          fail(
            'action-references-issue',
            `actionPlan.${phase} item "${item.id}" references issueId "${id}", which is not in issues[].`,
          );
        }
      }
    }
  }

  /* ── Evidence is mandatory for the findings users act on first ─────── */
  for (const issue of analysis.issues) {
    if ((issue.severity === 'critical' || issue.severity === 'high') && !issue.evidence) {
      fail(
        'evidence-required',
        `Issue "${issue.id}" has severity "${issue.severity}" and must include evidence drawn from the observed page data.`,
      );
    }
  }

  /* ── Heuristic categories must be disclosed in limitations ─────────── */
  const heuristicCategories = CATEGORY_ORDER.filter(
    (c: Category) => analysis.categoryScores[c].basis !== 'measured',
  );
  if (heuristicCategories.length > 0 && analysis.limitations.length === 0) {
    fail(
      'limitations-disclose-heuristics',
      `Categories ${heuristicCategories.join(', ')} are not directly measured, so limitations[] must explain what could not be determined.`,
    );
  }

  return problems;
}

/**
 * Overall score, computed — never taken from the model.
 *
 * A weighted mean over the six category scores. Because the weights live in one
 * const and the arithmetic lives here, the number is reproducible and the model
 * cannot contradict its own category breakdown.
 */
export function computeOverallScore(analysis: AuditAnalysis): number {
  let total = 0;
  for (const category of CATEGORY_ORDER) {
    total += analysis.categoryScores[category].score * CATEGORY_WEIGHTS[category];
  }
  return Math.round(total);
}
