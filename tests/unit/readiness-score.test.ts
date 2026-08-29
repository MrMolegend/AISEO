import { describe, it, expect } from 'vitest';
import {
  SCORE_WEIGHTS,
  VERDICT_BANDS,
  computeFactors,
  readinessFrom,
  verdictFrom,
  confidenceFrom,
  buildDecision,
} from '@/lib/market-entry/scoring';
import type { ModelReport, MarketSource } from '@/schemas/market-entry/report';
import { FIXTURE_SYNTHESIS } from '@/fixtures/market-entry/synthesis';
import { EXAMPLE_DOSSIER } from '@/fixtures/market-entry/example-dossier';

/**
 * The readiness model.
 *
 * The property that matters here is not "the number is right" — there is no
 * right number — but that the number is *derived*: the same report always
 * produces the same score, every input that moves it is nameable, and no part
 * of it comes from prose the model wrote. So these tests drive the factors
 * directly with constructed reports and assert direction and boundaries, and
 * one test asserts the whole thing is reproducible.
 */

function source(overrides: Partial<MarketSource> = {}): MarketSource {
  return {
    ref: 'S1',
    position: 1,
    url: 'https://example.gov.example/a',
    title: 'A page',
    publisher: 'example.gov.example',
    category: 'official',
    retrievalMode: 'direct',
    retrievedAt: '2026-03-14T09:20:00.000Z',
    publishedAt: null,
    geographicRelevance: 'target-market',
    excerpt: 'An excerpt.',
    confidence: 'high',
    supports: [],
    ...overrides,
  };
}

function sources(count: number, overrides: Partial<MarketSource> = {}): MarketSource[] {
  return Array.from({ length: count }, (_, index) =>
    source({
      ref: `S${index + 1}`,
      position: index + 1,
      url: `https://pub${index}.example/page`,
      publisher: `pub${index}.example`,
      ...overrides,
    }),
  );
}

const factorScore = (report: ModelReport, list: MarketSource[], id: string) =>
  computeFactors(report, list).find((factor) => factor.id === id)?.score ?? -1;

describe('weights', () => {
  it('sum to exactly one', () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });

  it('give evidence and regulatory clarity more weight than any conclusion', () => {
    // The model exists to reward being well-evidenced, not being optimistic.
    expect(SCORE_WEIGHTS.evidenceDepth).toBeGreaterThan(SCORE_WEIGHTS.routeFit);
    expect(SCORE_WEIGHTS.regulatoryClarity).toBeGreaterThan(
      SCORE_WEIGHTS.competitiveClarity,
    );
    expect(SCORE_WEIGHTS.riskLoad).toBeGreaterThan(SCORE_WEIGHTS.competitiveClarity);
  });
});

describe('verdict bands', () => {
  it.each([
    [100, 'promising'],
    [VERDICT_BANDS.promising, 'promising'],
    [VERDICT_BANDS.promising - 1, 'promising-with-conditions'],
    [VERDICT_BANDS.conditional, 'promising-with-conditions'],
    [VERDICT_BANDS.conditional - 1, 'high-risk'],
    [0, 'high-risk'],
  ])('maps %i to %s', (readiness, verdict) => {
    expect(verdictFrom(readiness)).toBe(verdict);
  });
});

describe('evidence depth', () => {
  it('rises with credible sources and with how many were read directly', () => {
    const thin = factorScore(
      FIXTURE_SYNTHESIS,
      sources(4, { retrievalMode: 'indexed' }),
      'evidenceDepth',
    );
    const deep = factorScore(FIXTURE_SYNTHESIS, sources(16), 'evidenceDepth');
    expect(deep).toBeGreaterThan(thin);
    expect(deep).toBe(1);
  });

  it('does not count sources that are not credible', () => {
    const blog = sources(16, { category: 'other' });
    expect(factorScore(FIXTURE_SYNTHESIS, blog, 'evidenceDepth')).toBeLessThan(
      factorScore(FIXTURE_SYNTHESIS, sources(16), 'evidenceDepth'),
    );
  });
});

describe('regulatory clarity', () => {
  const withRequirements = (
    requirements: ModelReport['regulation']['requirements'],
    gaps: string[] = [],
  ): ModelReport => ({
    ...FIXTURE_SYNTHESIS,
    regulation: { ...FIXTURE_SYNTHESIS.regulation, requirements, gaps },
  });

  const requirement = (cited: boolean) => ({
    ...FIXTURE_SYNTHESIS.regulation.requirements[0]!,
    evidence: [
      {
        ...FIXTURE_SYNTHESIS.regulation.requirements[0]!.evidence[0]!,
        sources: cited ? ['S1'] : [],
      },
    ],
  });

  it('scores a report with no requirements as neither clear nor unclear', () => {
    expect(factorScore(withRequirements([]), sources(8), 'regulatoryClarity')).toBe(0.35);
  });

  it('rewards requirements that rest on a named authority', () => {
    const backed = factorScore(
      withRequirements([requirement(true)]),
      sources(8),
      'regulatoryClarity',
    );
    const bare = factorScore(
      withRequirements([requirement(false)]),
      sources(8),
      'regulatoryClarity',
    );
    expect(backed).toBeGreaterThan(bare);
  });

  it('is reduced, not zeroed, by admitted gaps', () => {
    const clean = factorScore(
      withRequirements([requirement(true)]),
      sources(8),
      'regulatoryClarity',
    );
    const gappy = factorScore(
      withRequirements(
        [requirement(true)],
        ['Tariff rate unconfirmed', 'Halal scope unclear'],
      ),
      sources(8),
      'regulatoryClarity',
    );
    expect(gappy).toBeLessThan(clean);
    expect(gappy).toBeGreaterThan(0);
  });
});

describe('demand signal', () => {
  it('is zero when nothing was found', () => {
    const empty: ModelReport = {
      ...FIXTURE_SYNTHESIS,
      marketSignals: {
        ...FIXTURE_SYNTHESIS.marketSignals,
        demand: [],
        growth: [],
        customerBehaviour: [],
      },
    };
    expect(factorScore(empty, sources(8), 'demandSignal')).toBe(0);
  });

  it('rates read evidence above reasoning', () => {
    const claim = FIXTURE_SYNTHESIS.marketSignals.demand[0]!;
    const read: ModelReport = {
      ...FIXTURE_SYNTHESIS,
      marketSignals: {
        ...FIXTURE_SYNTHESIS.marketSignals,
        demand: [{ ...claim, basis: 'sourced' }],
        growth: [],
        customerBehaviour: [],
      },
    };
    const reasoned: ModelReport = {
      ...read,
      marketSignals: {
        ...read.marketSignals,
        demand: [{ ...claim, basis: 'inferred' }],
      },
    };
    expect(factorScore(read, sources(8), 'demandSignal')).toBeGreaterThan(
      factorScore(reasoned, sources(8), 'demandSignal'),
    );
  });
});

describe('risk load', () => {
  it('lowers readiness as the register gets heavier', () => {
    const light: ModelReport = {
      ...FIXTURE_SYNTHESIS,
      risks: [{ ...FIXTURE_SYNTHESIS.risks[0]!, probability: 'low', impact: 'low' }],
    };
    const heavy: ModelReport = {
      ...FIXTURE_SYNTHESIS,
      risks: Array.from({ length: 6 }, () => ({
        ...FIXTURE_SYNTHESIS.risks[0]!,
        probability: 'high' as const,
        impact: 'high' as const,
      })),
    };
    expect(factorScore(heavy, sources(8), 'riskLoad')).toBeLessThan(
      factorScore(light, sources(8), 'riskLoad'),
    );
  });

  it('never lets a thorough risk section outweigh the evidence factors', () => {
    // 15% is the cap by construction: worst-case risk load can move readiness
    // by at most fifteen points, which cannot on its own cross two bands.
    const light: ModelReport = {
      ...FIXTURE_SYNTHESIS,
      risks: [{ ...FIXTURE_SYNTHESIS.risks[0]!, probability: 'low', impact: 'low' }],
    };
    const heavy: ModelReport = {
      ...FIXTURE_SYNTHESIS,
      risks: Array.from({ length: 12 }, () => ({
        ...FIXTURE_SYNTHESIS.risks[0]!,
        probability: 'high' as const,
        impact: 'high' as const,
      })),
    };
    const list = sources(12);
    const delta =
      readinessFrom(computeFactors(light, list)) -
      readinessFrom(computeFactors(heavy, list));
    expect(delta).toBeLessThanOrEqual(SCORE_WEIGHTS.riskLoad * 100 + 1);
  });
});

describe('commercial viability', () => {
  it('falls when the customer supplied nothing to assess', () => {
    const noFigures: ModelReport = {
      ...FIXTURE_SYNTHESIS,
      pricing: {
        ...FIXTURE_SYNTHESIS.pricing,
        researchedBenchmarks: [],
        missingData: [
          'Unit cost',
          'Current price',
          'Target price',
          'Budget',
          'Currency',
          'Volumes',
        ],
      },
    };
    expect(factorScore(noFigures, sources(8), 'commercialViability')).toBe(0);
  });
});

describe('readiness', () => {
  it('is bounded and integral', () => {
    for (const list of [sources(0), sources(3), sources(20)]) {
      const readiness = readinessFrom(computeFactors(FIXTURE_SYNTHESIS, list));
      expect(Number.isInteger(readiness)).toBe(true);
      expect(readiness).toBeGreaterThanOrEqual(0);
      expect(readiness).toBeLessThanOrEqual(100);
    }
  });

  it('is reproducible — the same report always scores the same', () => {
    const list = sources(11);
    const runs = Array.from({ length: 5 }, () =>
      readinessFrom(computeFactors(FIXTURE_SYNTHESIS, list)),
    );
    expect(new Set(runs).size).toBe(1);
  });

  it('scores a well-evidenced report above an identical unevidenced one', () => {
    const evidenced = readinessFrom(computeFactors(FIXTURE_SYNTHESIS, sources(14)));
    const unevidenced = readinessFrom(
      computeFactors(
        FIXTURE_SYNTHESIS,
        sources(2, { category: 'other', retrievalMode: 'indexed' }),
      ),
    );
    expect(evidenced).toBeGreaterThan(unevidenced);
  });
});

describe('confidence', () => {
  it('reads the evidence factors, not the conclusion', () => {
    const strong = confidenceFrom([
      { id: 'evidenceDepth', label: '', weight: 0.2, score: 0.9, explanation: '' },
      { id: 'regulatoryClarity', label: '', weight: 0.2, score: 0.8, explanation: '' },
    ]);
    const weak = confidenceFrom([
      { id: 'evidenceDepth', label: '', weight: 0.2, score: 0.2, explanation: '' },
      { id: 'regulatoryClarity', label: '', weight: 0.2, score: 0.1, explanation: '' },
    ]);
    expect(strong).toBe('high');
    expect(weak).toBe('low');
  });

  it('can be high on a high-risk verdict — a confident bad answer is still confident', () => {
    const factors = [
      { id: 'evidenceDepth', label: '', weight: 0.2, score: 1, explanation: '' },
      { id: 'regulatoryClarity', label: '', weight: 0.2, score: 1, explanation: '' },
    ];
    expect(confidenceFrom(factors)).toBe('high');
    expect(verdictFrom(20)).toBe('high-risk');
  });
});

describe('buildDecision', () => {
  it('carries every factor with its weight and an explanation', () => {
    const decision = buildDecision({
      report: FIXTURE_SYNTHESIS,
      sources: sources(10),
      businessName: 'A Co',
      productName: 'A product',
      originCountry: 'IE',
      targetCountry: 'AE',
      targetRegion: null,
      researchedAt: '2026-03-14T09:20:00.000Z',
    });

    expect(decision.factors).toHaveLength(Object.keys(SCORE_WEIGHTS).length);
    for (const factor of decision.factors) {
      expect(factor.explanation.length).toBeGreaterThan(0);
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(1);
    }
    expect(decision.verdict).toBe(verdictFrom(decision.readiness));
  });

  it('produces the verdict the published example claims', () => {
    // The example dossier is a marketing page. If the model changes, the page
    // it ships must change with it rather than keep a stale verdict.
    expect(EXAMPLE_DOSSIER.decision.verdict).toBe(
      verdictFrom(EXAMPLE_DOSSIER.decision.readiness),
    );
  });
});
