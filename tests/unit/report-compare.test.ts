import { describe, it, expect } from 'vitest';
import {
  compareReports,
  comparisonHasChanges,
  type VersionComparison,
} from '@/lib/market-entry/compare';
import { EXAMPLE_DOSSIER } from '@/fixtures/market-entry/example-dossier';
import type { MarketEntryReport } from '@/schemas/market-entry/report';

/**
 * The version comparison is a computation, and these tests hold it to that:
 * identical inputs produce a no-change result, the same pair produces the
 * same output twice, and every kind of difference — verdict, score, list
 * membership, field edits — lands in the section that owns it.
 */

function clone(): MarketEntryReport {
  return JSON.parse(JSON.stringify(EXAMPLE_DOSSIER)) as MarketEntryReport;
}

describe('compareReports', () => {
  it('reports an identical pair as unchanged everywhere', () => {
    const comparison = compareReports(EXAMPLE_DOSSIER, clone());

    expect(comparison.verdict.changed).toBe(false);
    expect(comparison.readiness.delta).toBe(0);
    expect(comparison.headlineClaims.every((claim) => !claim.changed)).toBe(true);
    for (const diff of [
      comparison.risks,
      comparison.regulation,
      comparison.planActions,
    ]) {
      expect(diff.added).toEqual([]);
      expect(diff.removed).toEqual([]);
      expect(diff.changed).toEqual([]);
    }
    expect(comparisonHasChanges(comparison)).toBe(false);
  });

  it('is deterministic: the same pair compares identically twice', () => {
    const later = clone();
    later.decision.readiness = Math.min(100, later.decision.readiness + 7);
    later.risks.pop();

    const first = compareReports(EXAMPLE_DOSSIER, later);
    const second = compareReports(EXAMPLE_DOSSIER, later);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('routes each kind of change to the section that owns it', () => {
    const later = clone();
    later.decision.verdict =
      later.decision.verdict === 'promising' ? 'high-risk' : 'promising';
    later.decision.readiness = Math.max(0, later.decision.readiness - 12);
    later.executive.largestObstacle.statement = 'A completely different obstacle.';

    // One risk removed, one added, one edited.
    const removedRisk = later.risks.shift()!;
    later.risks.push({
      ...removedRisk,
      id: 'entirely-new-risk',
      title: 'A risk the first run had not surfaced',
    });
    if (later.risks[0]) {
      later.risks[0].probability = later.risks[0].probability === 'high' ? 'low' : 'high';
    }

    // A plan action moves phase.
    if (later.plan.actions[0]) {
      later.plan.actions[0].phase =
        later.plan.actions[0].phase === 'days-1-30' ? 'days-31-60' : 'days-1-30';
    }

    const comparison = compareReports(EXAMPLE_DOSSIER, later);

    expect(comparison.verdict.changed).toBe(true);
    expect(comparison.readiness.delta).toBe(-12);
    expect(
      comparison.headlineClaims.find((claim) => claim.label === 'Largest obstacle')
        ?.changed,
    ).toBe(true);

    expect(comparison.risks.added.map((item) => item.title)).toContain(
      'A risk the first run had not surfaced',
    );
    expect(comparison.risks.removed.map((item) => item.title)).toContain(
      removedRisk.title,
    );
    expect(
      comparison.risks.changed.some((item) => item.fields.includes('probability')),
    ).toBe(true);

    expect(
      comparison.planActions.changed.some((item) => item.fields.includes('phase')),
    ).toBe(true);

    expect(comparisonHasChanges(comparison)).toBe(true);
  });

  it('never manufactures prose: every string in the output is from a report or a label', () => {
    const later = clone();
    later.executive.attractiveness.statement = 'Sentinel statement for provenance.';

    const comparison = compareReports(EXAMPLE_DOSSIER, later);
    const attractiveness = comparison.headlineClaims.find(
      (claim) => claim.label === 'Market attractiveness',
    );
    // Statements pass through verbatim — no paraphrase, no summary.
    expect(attractiveness?.after).toBe('Sentinel statement for provenance.');
    expect(attractiveness?.before).toBe(
      EXAMPLE_DOSSIER.executive.attractiveness.statement,
    );
  });

  it('matches factor lists by id so a renamed label cannot double-count', () => {
    const later = clone();
    const factor = later.decision.factors[0];
    if (factor) {
      factor.label = 'Renamed for presentation';
      factor.score = Math.min(1, factor.score + 0.2);
    }

    const comparison: VersionComparison = compareReports(EXAMPLE_DOSSIER, later);
    const ids = comparison.factors.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(comparison.factors).toHaveLength(EXAMPLE_DOSSIER.decision.factors.length);
  });
});
