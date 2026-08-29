import {
  classifySource,
  geographicRelevanceOf,
  publisherOf,
} from '@/lib/research/classify';
import { gradeReport, limitationsFromDemotions } from '@/lib/validation/market-entry';
import { buildDecision } from '@/lib/market-entry/scoring';
import { buildScenarios } from '@/lib/market-entry/pricing';
import { countryName } from '@/config/markets';
import { MARKET_ENTRY_SCHEMA_VERSION } from '@/schemas/market-entry/report';
import type { MarketEntryReport, MarketSource } from '@/schemas/market-entry/report';
import type { GradingSource } from '@/schemas/market-entry/evidence';
import { ALL_FIXTURE_RESULTS } from './search-results';
import { FIXTURE_SYNTHESIS } from './synthesis';
import { EXAMPLE_INPUT } from './case';

/**
 * The worked example, assembled the way the pipeline assembles a real report.
 *
 * Every derived part is computed here by the same functions the runner calls —
 * source classification, geographic relevance, evidence grading, the readiness
 * model, the margin scenarios. Only two things are declared rather than
 * executed: which sources the retrieval budget reached, and which of those it
 * failed to read. Executing those would mean running an async fetch loop at
 * module load on a marketing page, which is a bad trade for a fixture.
 *
 * The declaration is not left to drift. tests/integration/example-dossier.test.ts
 * runs the real pipeline over the same fixtures and asserts this file's direct
 * and blocked sets match what it produced, so the example a visitor reads
 * cannot quietly stop being what the product does.
 */

/**
 * The six sources the retrieval budget reached and read.
 *
 * Derived by the pipeline from source category and provider relevance: the
 * authorities first, one page per publisher before any second page, capped at
 * eight attempts.
 */
const DIRECTLY_RETRIEVED = new Set([
  'https://moccae.gov.example/services/food-import-registration',
  'https://dm.gov.example/food-safety/labelling-requirements',
  'https://customs.gov.example/tariff/chapter-25-salt',
  'https://fcsc.gov.example/publications/food-import-statistics-2025',
  'https://gulfoodtrade.example/guides/appointing-a-distributor',
  'https://carrefouruae.example/c/grocery/cooking-essentials/salt',
]);

/** The two the budget reached and could not read. Both fail on purpose. */
const BLOCKED = [
  {
    url: 'https://dubaichamber.example/insights/retail-buyer-listing-process',
    publisher: 'dubaichamber.example',
    reason: 'robots-disallowed' as const,
  },
  {
    url: 'https://speciality-food-mena.example/reports/premium-pantry-price-architecture',
    publisher: 'speciality-food-mena.example',
    reason: 'timeout' as const,
  },
];

const RESEARCHED_AT = '2026-03-14T09:20:00.000Z';

function buildSources(): MarketSource[] {
  const targetName = countryName(EXAMPLE_INPUT.targetCountry);
  const originName = countryName(EXAMPLE_INPUT.originCountry);

  return ALL_FIXTURE_RESULTS.map((result, index) => {
    const direct = DIRECTLY_RETRIEVED.has(result.url);
    return {
      ref: `S${index + 1}`,
      position: index + 1,
      url: result.url,
      title: result.title,
      publisher: publisherOf(result.url),
      category: classifySource(result.url, result.title),
      retrievalMode: direct ? ('direct' as const) : ('indexed' as const),
      retrievedAt: RESEARCHED_AT,
      publishedAt: result.publishedDate,
      geographicRelevance: geographicRelevanceOf({
        url: result.url,
        title: result.title,
        targetCountry: EXAMPLE_INPUT.targetCountry,
        targetCountryName: targetName,
        targetRegion: EXAMPLE_INPUT.targetRegion,
        originCountry: EXAMPLE_INPUT.originCountry,
        originCountryName: originName,
      }),
      excerpt: result.excerpt.slice(0, 1200),
      confidence: direct ? ('high' as const) : ('medium' as const),
      supports: [],
    };
  });
}

function assemble(): MarketEntryReport {
  const sources = buildSources();

  const gradingSources = new Map<string, GradingSource>(
    sources.map((source) => [
      source.ref,
      { category: source.category, retrievalMode: source.retrievalMode },
    ]),
  );

  const { grades, demotions } = gradeReport(FIXTURE_SYNTHESIS, gradingSources);

  const decision = buildDecision({
    report: FIXTURE_SYNTHESIS,
    sources,
    businessName: EXAMPLE_INPUT.businessName,
    productName: EXAMPLE_INPUT.productName,
    originCountry: EXAMPLE_INPUT.originCountry,
    targetCountry: EXAMPLE_INPUT.targetCountry,
    targetRegion: EXAMPLE_INPUT.targetRegion,
    researchedAt: RESEARCHED_AT,
  });

  const direct = sources.filter((source) => source.retrievalMode === 'direct').length;
  const authoritative = sources.filter((source) =>
    [
      'official',
      'regulator',
      'customs',
      'statistical',
      'trade_association',
      'chamber',
    ].includes(source.category),
  ).length;
  const publishers = new Set(sources.map((source) => source.publisher));

  return {
    ...FIXTURE_SYNTHESIS,
    schemaVersion: MARKET_ENTRY_SCHEMA_VERSION,
    decision,
    scenarios: buildScenarios(EXAMPLE_INPUT),
    coverage: {
      sourcesFound: sources.length,
      sourcesAccepted: sources.length,
      sourcesRejected: 0,
      directlyRetrieved: direct,
      fromIndexOnly: sources.length - direct,
      authoritative,
      distinctPublishers: publishers.size,
      blocked: BLOCKED,
      areasCovered: [],
      areasThin: [],
    },
    grades,
    sources,
    appendix: {
      ...FIXTURE_SYNTHESIS.appendix,
      limitations: [
        ...FIXTURE_SYNTHESIS.appendix.limitations,
        ...limitationsFromDemotions(demotions),
      ].slice(0, 12),
    },
  };
}

export const EXAMPLE_DOSSIER: MarketEntryReport = assemble();

/** Exposed for the test that pins this file to the real pipeline's output. */
export const EXAMPLE_DIRECT_URLS: readonly string[] = [...DIRECTLY_RETRIEVED];
export const EXAMPLE_BLOCKED_URLS: readonly string[] = BLOCKED.map((entry) => entry.url);
