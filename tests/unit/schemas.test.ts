import { describe, expect, it } from 'vitest';
import {
  auditReportSchema,
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  ratingForScore,
  SCHEMA_VERSION,
} from '@/schemas/audit';
import {
  crossReferenceAnalysis,
  computeOverallScore,
} from '@/lib/validation/cross-reference';
import { FIXTURE_NAMES, getRawFixture, type FixtureName } from '@/fixtures';

describe('audit schema', () => {
  describe.each(FIXTURE_NAMES)('fixture: %s', (name: FixtureName) => {
    const raw = getRawFixture(name);

    it('validates against auditReportSchema', () => {
      const result = auditReportSchema.safeParse(raw);
      if (!result.success) {
        throw new Error(
          `Fixture "${name}" failed schema validation:\n` +
            result.error.issues
              .map((i) => `  ${i.path.join('.')}: ${i.message}`)
              .join('\n'),
        );
      }
      expect(result.success).toBe(true);
    });

    it('passes every cross-reference rule', () => {
      const report = auditReportSchema.parse(raw);
      const problems = crossReferenceAnalysis(report.analysis);
      expect(
        problems,
        `Cross-reference failures:\n${problems.map((p) => `  [${p.rule}] ${p.message}`).join('\n')}`,
      ).toEqual([]);
    });

    it('has an overallScore matching the computed weighted mean', () => {
      const report = auditReportSchema.parse(raw);
      expect(report.overallScore).toBe(computeOverallScore(report.analysis));
    });

    it('has an overallRating consistent with its overallScore', () => {
      const report = auditReportSchema.parse(raw);
      expect(report.overallRating).toBe(ratingForScore(report.overallScore));
    });

    it('declares the current schema version', () => {
      const report = auditReportSchema.parse(raw);
      expect(report.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it('always states its limitations', () => {
      const report = auditReportSchema.parse(raw);
      expect(report.analysis.limitations.length).toBeGreaterThan(0);
    });
  });

  it('weights every category and sums to exactly 1', () => {
    const total = CATEGORY_ORDER.reduce((sum, c) => sum + CATEGORY_WEIGHTS[c], 0);
    expect(Object.keys(CATEGORY_WEIGHTS).sort()).toEqual([...CATEGORY_ORDER].sort());
    // Floating point: compare at a sane precision rather than exact equality.
    expect(total).toBeCloseTo(1, 10);
  });
});

describe('ratingForScore', () => {
  it.each([
    [100, 'excellent'],
    [90, 'excellent'],
    [89, 'good'],
    [75, 'good'],
    [74, 'needsImprovement'],
    [50, 'needsImprovement'],
    [49, 'poor'],
    [0, 'poor'],
  ] as const)('maps %i to %s', (score, expected) => {
    expect(ratingForScore(score)).toBe(expected);
  });

  it('clamps values outside 0-100', () => {
    expect(ratingForScore(1000)).toBe('excellent');
    expect(ratingForScore(-50)).toBe('poor');
  });
});
