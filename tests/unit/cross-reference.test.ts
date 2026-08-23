import { describe, expect, it } from 'vitest';
import { crossReferenceAnalysis } from '@/lib/validation/cross-reference';
import { getFixtureReport } from '@/fixtures';
import type { AuditAnalysis } from '@/schemas/audit';

/**
 * A rule that never fires is a rule that does not exist. Each case below breaks
 * exactly one invariant in an otherwise-valid analysis and asserts that the
 * matching rule — and only meaningful rules — reports it.
 */
function baseAnalysis(): AuditAnalysis {
  return structuredClone(getFixtureReport('strong-site').analysis);
}

const rulesFrom = (analysis: AuditAnalysis) =>
  crossReferenceAnalysis(analysis).map((p) => p.rule);

describe('crossReferenceAnalysis', () => {
  it('accepts a coherent analysis', () => {
    expect(crossReferenceAnalysis(baseAnalysis())).toEqual([]);
  });

  it('catches a topPriority pointing at a non-existent issue', () => {
    const analysis = baseAnalysis();
    analysis.topPriorities[0]!.issueId = 'does-not-exist';
    expect(rulesFrom(analysis)).toContain('priority-references-issue');
  });

  it('catches an actionPlan item pointing at a non-existent issue', () => {
    const analysis = baseAnalysis();
    analysis.actionPlan.immediate[0]!.issueIds = ['ghost-issue'];
    expect(rulesFrom(analysis)).toContain('action-references-issue');
  });

  it('catches duplicate issue ids', () => {
    const analysis = baseAnalysis();
    const first = analysis.issues[0]!;
    analysis.issues.push({ ...structuredClone(first) });
    expect(rulesFrom(analysis)).toContain('unique-ids');
  });

  it('catches non-contiguous priority ranks', () => {
    const analysis = baseAnalysis();
    // 1, 2, 3, 5 — a gap where 4 should be.
    analysis.topPriorities[analysis.topPriorities.length - 1]!.rank = 5;
    expect(rulesFrom(analysis)).toContain('contiguous-ranks');
  });

  it('catches duplicate priority ranks', () => {
    const analysis = baseAnalysis();
    analysis.topPriorities[1]!.rank = 1;
    expect(rulesFrom(analysis)).toContain('contiguous-ranks');
  });

  it('requires evidence on critical issues', () => {
    const analysis = baseAnalysis();
    const issue = analysis.issues[0]!;
    issue.severity = 'critical';
    issue.evidence = null;
    expect(rulesFrom(analysis)).toContain('evidence-required');
  });

  it('requires evidence on high-severity issues', () => {
    const analysis = baseAnalysis();
    const issue = analysis.issues[0]!;
    issue.severity = 'high';
    issue.evidence = null;
    expect(rulesFrom(analysis)).toContain('evidence-required');
  });

  it('permits missing evidence on medium and low severity issues', () => {
    const analysis = baseAnalysis();
    const issue = analysis.issues[0]!;
    issue.severity = 'low';
    issue.evidence = null;
    expect(rulesFrom(analysis)).not.toContain('evidence-required');
  });

  it('reports every distinct problem rather than stopping at the first', () => {
    const analysis = baseAnalysis();
    analysis.topPriorities[0]!.issueId = 'ghost-one';
    analysis.actionPlan.immediate[0]!.issueIds = ['ghost-two'];
    const rules = rulesFrom(analysis);
    expect(rules).toContain('priority-references-issue');
    expect(rules).toContain('action-references-issue');
  });
});
