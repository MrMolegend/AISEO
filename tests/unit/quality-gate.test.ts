import { describe, it, expect } from 'vitest';
import { evaluateQualityGate } from '@/lib/market-entry/quality-gate';
import { QUALITY_THRESHOLDS } from '@/config/report';
import type { ModelReport, MarketSource } from '@/schemas/market-entry/report';
import { FIXTURE_SYNTHESIS } from '@/fixtures/market-entry/synthesis';

/**
 * The gate that decides whether a report is worth charging for.
 *
 * Two failure modes, and they pull in opposite directions. A gate that never
 * fires charges people for empty documents. A gate that fires too readily
 * refunds constantly, teaches customers the product does not work, and burns
 * research we have already paid for. The tests below pin both edges, and the
 * ones that matter most are the "does not fire" cases: an honest gap is not a
 * failure.
 */

function sources(count: number, overrides: Partial<MarketSource> = {}): MarketSource[] {
  return Array.from({ length: count }, (_, index) => ({
    ref: `S${index + 1}`,
    position: index + 1,
    url: `https://pub${index}.example/page`,
    title: `Page ${index}`,
    publisher: `pub${index}.example`,
    category: 'industry_publication' as const,
    retrievalMode: 'indexed' as const,
    retrievedAt: '2026-03-14T09:20:00.000Z',
    publishedAt: null,
    geographicRelevance: 'target-market' as const,
    excerpt: 'An excerpt.',
    confidence: 'medium' as const,
    supports: [],
    ...overrides,
  }));
}

/**
 * A source set that clears every unconditional threshold, so a test that means
 * to probe one check is not accidentally tripping another.
 */
function researched(count = 12): MarketSource[] {
  const list = sources(count);
  for (
    let index = 0;
    index < QUALITY_THRESHOLDS.minAuthoritativeForRegulatoryClaims;
    index += 1
  ) {
    list[index] = { ...list[index]!, category: 'regulator', retrievalMode: 'direct' };
  }
  return list;
}

const evaluate = (
  report: ModelReport,
  list: MarketSource[],
  options: { providerIsLive?: boolean; servesRealCustomers?: boolean } = {},
) =>
  evaluateQualityGate({
    report,
    sources: list,
    providerIsLive: options.providerIsLive ?? true,
    servesRealCustomers: options.servesRealCustomers ?? false,
  });

/** A regulation section whose every claim is unverified — an honest gap. */
function withUnverifiedRegulation(report: ModelReport): ModelReport {
  return {
    ...report,
    regulation: {
      ...report.regulation,
      requirements: report.regulation.requirements.map((requirement) => ({
        ...requirement,
        evidence: requirement.evidence.map((claim) => ({
          ...claim,
          basis: 'unavailable' as const,
          sources: [],
        })),
      })),
      gaps: [...report.regulation.gaps, 'The regulator’s site could not be read.'],
    },
  };
}

describe('a substantial report passes', () => {
  it('passes on the worked example', () => {
    const outcome = evaluate(FIXTURE_SYNTHESIS, researched());
    expect(outcome.reasons).toEqual([]);
    expect(outcome.ok).toBe(true);
  });
});

describe('the gate catches a report with nothing in it', () => {
  it('fires below the credible-source floor', () => {
    const outcome = evaluate(
      FIXTURE_SYNTHESIS,
      sources(QUALITY_THRESHOLDS.minSources - 1),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons.join(' ')).toMatch(/credible sources/i);
  });

  it('does not count sources that are not credible towards the floor', () => {
    const outcome = evaluate(FIXTURE_SYNTHESIS, sources(20, { category: 'blog' }));
    expect(outcome.ok).toBe(false);
    expect(outcome.measured.credibleSources).toBe(0);
  });

  it('fires when everything came from one publisher', () => {
    const outcome = evaluate(
      FIXTURE_SYNTHESIS,
      researched().map((source) => ({ ...source, publisher: 'one.example' })),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons.join(' ')).toMatch(/single publisher/i);
  });

  it('fires when the report does not say what it could not establish', () => {
    const outcome = evaluate(
      {
        ...FIXTURE_SYNTHESIS,
        appendix: { ...FIXTURE_SYNTHESIS.appendix, limitations: [] },
      },
      researched(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons.join(' ')).toMatch(/could not establish/i);
  });

  it('fires when no routes were compared', () => {
    const outcome = evaluate(
      {
        ...FIXTURE_SYNTHESIS,
        route: {
          ...FIXTURE_SYNTHESIS.route,
          options: FIXTURE_SYNTHESIS.route.options.slice(0, 1),
        },
      },
      researched(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons.join(' ')).toMatch(/route-to-market/i);
  });

  it('fires when competitors are named but none is backed by evidence', () => {
    const outcome = evaluate(
      {
        ...FIXTURE_SYNTHESIS,
        competitive: {
          ...FIXTURE_SYNTHESIS.competitive,
          entries: FIXTURE_SYNTHESIS.competitive.entries.map((entry) => ({
            ...entry,
            productOverlap: { ...entry.productOverlap, sources: [] },
            customerOverlap: { ...entry.customerOverlap, sources: [] },
            marketPresence: { ...entry.marketPresence, sources: [] },
          })),
        },
      },
      researched(),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons.join(' ')).toMatch(/backed by evidence/i);
  });
});

describe('the gate does not punish an honest gap', () => {
  it('does not apply the regulatory check to a report that asserts no regulation', () => {
    // This is the non-negotiable one. An unreachable authority means the claims
    // were demoted to unverified upstream, so the report is not asserting them,
    // so the "≥2 authoritative sources" condition must not apply.
    const honest = withUnverifiedRegulation(FIXTURE_SYNTHESIS);
    const outcome = evaluate(honest, sources(12, { category: 'industry_publication' }));

    expect(outcome.measured.assertsRegulation).toBe(false);
    expect(outcome.measured.authoritativeSources).toBe(0);
    expect(outcome.ok).toBe(true);
  });

  it('does apply it to a report that does assert regulation', () => {
    const outcome = evaluate(
      FIXTURE_SYNTHESIS,
      sources(12, { category: 'industry_publication' }),
    );
    expect(outcome.measured.assertsRegulation).toBe(true);
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons.join(' ')).toMatch(
      /official, regulatory or recognised trade/i,
    );
  });

  it('passes a regulatory report once enough authorities are reachable', () => {
    expect(evaluate(FIXTURE_SYNTHESIS, researched()).ok).toBe(true);
  });

  it('does not fire the competitor check on a market with no competitors found', () => {
    // An empty list with a stated reason is a finding; the check is conditional
    // on the report naming competitors at all.
    const outcome = evaluate(
      {
        ...FIXTURE_SYNTHESIS,
        competitive: { ...FIXTURE_SYNTHESIS.competitive, entries: [] },
      },
      researched(),
    );
    expect(outcome.reasons.join(' ')).not.toMatch(/competitors or substitutes/i);
  });

  it('is unmoved by blocked pages as such', () => {
    // Nothing in the gate reads the blocked list. Twelve credible sources with
    // eight failed fetches is still twelve credible sources.
    expect(
      evaluate(FIXTURE_SYNTHESIS, sources(12, { retrievalMode: 'indexed' })).measured
        .credibleSources,
    ).toBe(12);
  });
});

describe('the production mock prohibition', () => {
  it('fails a fixture-built report on a deployment customers reach', () => {
    const outcome = evaluate(FIXTURE_SYNTHESIS, researched(), {
      providerIsLive: false,
      servesRealCustomers: true,
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.reasons.join(' ')).toMatch(/not carried out against live sources/i);
  });

  it('is inert in CI, where the fixture provider is the point', () => {
    const outcome = evaluate(FIXTURE_SYNTHESIS, researched(), {
      providerIsLive: false,
      servesRealCustomers: false,
    });
    expect(outcome.ok).toBe(true);
  });

  it('never fires when the provider is live', () => {
    const outcome = evaluate(FIXTURE_SYNTHESIS, researched(), {
      providerIsLive: true,
      servesRealCustomers: true,
    });
    expect(outcome.reasons.join(' ')).not.toMatch(/live sources/i);
  });
});

describe('reasons are customer-readable', () => {
  it('carries no internal identifiers, thresholds objects or field paths', () => {
    const outcome = evaluate(
      {
        ...FIXTURE_SYNTHESIS,
        appendix: { ...FIXTURE_SYNTHESIS.appendix, limitations: [] },
      },
      sources(1),
    );
    for (const reason of outcome.reasons) {
      expect(reason).toMatch(/^[A-Z].*[.]$/s);
      expect(reason).not.toMatch(/[a-z]+\.[a-z]+\./);
      expect(reason).not.toMatch(/undefined|null|QUALITY_THRESHOLDS/);
    }
  });
});
