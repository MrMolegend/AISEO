import { describe, it, expect } from 'vitest';
import {
  deriveEvidenceGrade,
  isSensitivePath,
  SOURCE_CATEGORIES,
  isAuthoritative,
  isCredible,
  type GradingSource,
} from '@/schemas/market-entry/evidence';
import { gradeReport, limitationsFromDemotions } from '@/lib/validation/market-entry';
import { FIXTURE_SYNTHESIS } from '@/fixtures/market-entry/synthesis';
import { EXAMPLE_DOSSIER } from '@/fixtures/market-entry/example-dossier';

/**
 * How a claim gets its label.
 *
 * The single rule this whole product rests on: an indexed search summary may
 * support a weak signal but not a regulatory, financial or market-size claim.
 * Everything below is that rule, from both directions.
 */

const direct = (category: GradingSource['category']): GradingSource => ({
  category,
  retrievalMode: 'direct',
});
const indexed = (category: GradingSource['category']): GradingSource => ({
  category,
  retrievalMode: 'indexed',
});

describe('the grade is derived, never declared', () => {
  it('reports the customer’s own answers as theirs', () => {
    expect(deriveEvidenceGrade({ basis: 'provided', sources: [], sensitive: false })).toBe(
      'provided',
    );
  });

  it('reports our own arithmetic as modelled', () => {
    expect(deriveEvidenceGrade({ basis: 'modelled', sources: [], sensitive: false })).toBe(
      'modelled',
    );
  });

  it('reports reasoning as inference even when sources are attached', () => {
    // Citing a source next to a conclusion drawn from it does not make the
    // conclusion something the source said.
    expect(
      deriveEvidenceGrade({
        basis: 'inferred',
        sources: [direct('official')],
        sensitive: false,
      }),
    ).toBe('inference');
  });

  it('reports an absence as unknown', () => {
    expect(
      deriveEvidenceGrade({ basis: 'unavailable', sources: [], sensitive: false }),
    ).toBe('unknown');
  });
});

describe('the indexed-snippet rule', () => {
  it('lets an index summary carry an ordinary finding', () => {
    expect(
      deriveEvidenceGrade({
        basis: 'sourced',
        sources: [indexed('industry_publication')],
        sensitive: false,
      }),
    ).toBe('verified');
  });

  it('refuses to let it carry a regulatory claim alone', () => {
    expect(
      deriveEvidenceGrade({
        basis: 'sourced',
        sources: [indexed('regulator')],
        sensitive: true,
      }),
    ).toBe('unknown');
  });

  it('accepts a regulatory claim once we have opened the page', () => {
    expect(
      deriveEvidenceGrade({
        basis: 'measured',
        sources: [direct('regulator')],
        sensitive: true,
      }),
    ).toBe('verified');
  });

  it('accepts it when one of several sources was opened', () => {
    expect(
      deriveEvidenceGrade({
        basis: 'sourced',
        sources: [indexed('news'), direct('customs')],
        sensitive: true,
      }),
    ).toBe('verified');
  });

  it('will not accept an unclassifiable page as evidence at all', () => {
    expect(
      deriveEvidenceGrade({
        basis: 'measured',
        sources: [direct('other')],
        sensitive: false,
      }),
    ).toBe('unknown');
  });

  it('will not accept a claim with no source as a fact', () => {
    expect(
      deriveEvidenceGrade({ basis: 'measured', sources: [], sensitive: false }),
    ).toBe('unknown');
  });
});

describe('which claims are sensitive', () => {
  it('covers regulation, market size, growth and price benchmarks', () => {
    for (const path of [
      'regulation',
      'regulation.requirements[0].evidence[1]',
      'marketSignals.size',
      'marketSignals.growth[0]',
      'pricing.researchedBenchmarks[2]',
      'competitive.entries.pricing',
    ]) {
      expect(isSensitivePath(path), path).toBe(true);
    }
  });

  it('leaves ordinary findings alone', () => {
    for (const path of [
      'marketSignals.demand[0]',
      'customers.groups[1].motivations[0]',
      'route.options[0].evidence[0]',
      'executive.strongestOpportunity',
    ]) {
      expect(isSensitivePath(path), path).toBe(false);
    }
  });

  it('does not match a path that merely starts with the same letters', () => {
    expect(isSensitivePath('regulationsNote')).toBe(false);
  });
});

describe('source categories', () => {
  it('treats government, regulators, customs, statistics and trade bodies as authoritative', () => {
    for (const category of [
      'official',
      'regulator',
      'customs',
      'statistical',
      'trade_association',
      'chamber',
    ] as const) {
      expect(isAuthoritative(category), category).toBe(true);
    }
  });

  it('does not treat trade press or a retailer as an authority', () => {
    // Trade press reporting what a regulator said is context, not the rule.
    expect(isAuthoritative('industry_publication')).toBe(false);
    expect(isAuthoritative('retailer')).toBe(false);
    expect(isAuthoritative('news')).toBe(false);
  });

  it('counts everything but "other" toward the source threshold', () => {
    for (const category of SOURCE_CATEGORIES) {
      expect(isCredible(category), category).toBe(category !== 'other');
    }
  });
});

describe('grading a whole report', () => {
  it('labels every claim it finds', () => {
    const sources = new Map(
      EXAMPLE_DOSSIER.sources.map((source) => [
        source.ref,
        { category: source.category, retrievalMode: source.retrievalMode },
      ]),
    );
    const { grades } = gradeReport(FIXTURE_SYNTHESIS, sources);

    expect(Object.keys(grades).length).toBeGreaterThan(40);
    // Nothing is left unlabelled: an unlabelled claim reads as a fact.
    for (const [path, grade] of Object.entries(grades)) {
      expect(grade, path).toBeTruthy();
    }
  });

  it('demotes a price benchmark that rests on a page we could not open', () => {
    // The worked example's second benchmark cites a trade-press page that the
    // fixture deliberately fails to retrieve.
    const demoted = Object.entries(EXAMPLE_DOSSIER.grades).filter(
      ([path, grade]) => path.startsWith('pricing.researchedBenchmarks') && grade === 'unknown',
    );
    expect(demoted.length).toBeGreaterThan(0);
  });

  it('keeps the regulatory claims that rest on authorities we did open', () => {
    const regulatory = Object.entries(EXAMPLE_DOSSIER.grades).filter(([path]) =>
      path.startsWith('regulation.requirements'),
    );
    expect(regulatory.length).toBeGreaterThan(0);
    expect(regulatory.every(([, grade]) => grade === 'verified')).toBe(true);
  });

  it('turns demotions into limitations a reader sees', () => {
    const sources = new Map(
      EXAMPLE_DOSSIER.sources.map((source) => [
        source.ref,
        { category: source.category, retrievalMode: source.retrievalMode },
      ]),
    );
    const { demotions } = gradeReport(FIXTURE_SYNTHESIS, sources);
    const limitations = limitationsFromDemotions(demotions);

    expect(demotions.length).toBeGreaterThan(0);
    expect(limitations.length).toBeGreaterThan(0);
    // Grouped by section: eleven lines saying the same thing is noise.
    expect(limitations.length).toBeLessThanOrEqual(demotions.length);
    expect(limitations[0]?.detail).toMatch(/unverified/);
  });

  it('never drops a demoted claim from the report', () => {
    // Demotion is a label, not a deletion. The statement still appears.
    const benchmarks = EXAMPLE_DOSSIER.pricing.researchedBenchmarks;
    expect(benchmarks.length).toBe(2);
    expect(benchmarks[1]?.statement).toContain('three to four times');
  });
});
