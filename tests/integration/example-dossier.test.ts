import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createResearchJob } from '@/lib/jobs/create-job';
import { runResearchJob } from '@/lib/jobs/run-job';
import {
  getResearchJobStore,
  resetResearchJobStoreCache,
  resetMemoryJobStore,
} from '@/lib/jobs/store';
import { getTokenWallet, resetTokenWalletCache } from '@/lib/tokens';
import { resetMemoryWallet } from '@/lib/tokens/memory-wallet';
import { FixtureResearchProvider, resetResearchProviderCache } from '@/lib/research';
import { resetRateLimiter } from '@/lib/security/rate-limit';
import {
  EXAMPLE_DOSSIER,
  EXAMPLE_DIRECT_URLS,
  EXAMPLE_BLOCKED_URLS,
} from '@/fixtures/market-entry/example-dossier';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';
import {
  MARKET_ENTRY_SCHEMA_VERSION,
  marketEntryReportSchema,
} from '@/schemas/market-entry/report';
import type { MarketEntryReport } from '@/schemas/market-entry/report';

/**
 * The example page must be what the product actually does.
 *
 * `/example` is a marketing page, and a marketing page assembled by hand is a
 * marketing page that quietly stops being true. This one is assembled by the
 * same functions the runner calls, with exactly two things declared rather than
 * executed: which sources the retrieval budget reached, and which of those it
 * could not read. Executing those at module load would mean an async fetch loop
 * running to render a landing page.
 *
 * So they are pinned here instead. This test runs the real pipeline over the
 * same fixtures and asserts the declaration matches what it produced — which
 * means the two things the example page asserts about retrieval cannot drift
 * from what retrieval does.
 */

const USER = '66666666-6666-4666-8666-666666666666';

let produced: MarketEntryReport;

beforeEach(async () => {
  resetMemoryJobStore();
  resetMemoryWallet();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetResearchProviderCache();
  resetRateLimiter();
  FixtureResearchProvider.reset();

  const wallet = await getTokenWallet();
  await wallet.bootstrap(USER, { welcomeTokens: 0 });
  await wallet.grant({
    userId: USER,
    amount: 1000,
    type: 'admin_grant',
    idempotencyKey: 'grant:example-dossier',
    description: 'Test funding',
  });

  const created = await createResearchJob({
    userId: USER,
    body: { ...EXAMPLE_SUBMISSION },
    submissionId: 'example-dossier-run',
    ipHash: null,
  });
  await runResearchJob(created.job);

  const store = await getResearchJobStore();
  const job = await store.getForUser(created.job.publicId, USER);
  expect(job?.status, job?.errorCode ?? 'no error').toBe('complete');
  produced = job!.report as MarketEntryReport;
});

afterEach(() => {
  FixtureResearchProvider.reset();
});

describe('the published example matches the pipeline', () => {
  it('reads the same pages directly', () => {
    const fromPipeline = produced.sources
      .filter((source) => source.retrievalMode === 'direct')
      .map((source) => source.url)
      .sort();

    expect(fromPipeline).toEqual([...EXAMPLE_DIRECT_URLS].sort());
  });

  it('is blocked by the same pages, for the same reasons', () => {
    const fromPipeline = produced.coverage.blocked.map((entry) => entry.url).sort();
    expect(fromPipeline).toEqual([...EXAMPLE_BLOCKED_URLS].sort());

    for (const declared of EXAMPLE_DOSSIER.coverage.blocked) {
      const actual = produced.coverage.blocked.find(
        (entry) => entry.url === declared.url,
      );
      expect(actual?.reason, `${declared.url} now fails differently`).toBe(
        declared.reason,
      );
    }
  });

  it('registers the same sources in the same order, so citations point at the same pages', () => {
    // Ordering assigns the S-numbers. Getting it wrong once made every
    // regulatory citation point at a supermarket, and every regulatory claim
    // was silently demoted to unverified as a result.
    expect(produced.sources.map((source) => source.url)).toEqual(
      EXAMPLE_DOSSIER.sources.map((source) => source.url),
    );
    expect(produced.sources.map((source) => source.ref)).toEqual(
      EXAMPLE_DOSSIER.sources.map((source) => source.ref),
    );
  });

  it('classifies them identically', () => {
    for (const [index, source] of produced.sources.entries()) {
      const declared = EXAMPLE_DOSSIER.sources[index]!;
      expect(source.category, `${source.url} is now a ${source.category}`).toBe(
        declared.category,
      );
      expect(source.geographicRelevance).toBe(declared.geographicRelevance);
    }
  });

  it('reaches the same verdict from the same evidence', () => {
    expect(produced.decision.verdict).toBe(EXAMPLE_DOSSIER.decision.verdict);
    expect(produced.decision.readiness).toBe(EXAMPLE_DOSSIER.decision.readiness);
    expect(produced.decision.confidence).toBe(EXAMPLE_DOSSIER.decision.confidence);
  });

  it('grades every claim identically', () => {
    expect(produced.grades).toEqual(EXAMPLE_DOSSIER.grades);
  });

  it('computes the same margin scenarios', () => {
    expect(produced.scenarios).toEqual(EXAMPLE_DOSSIER.scenarios);
  });
});

describe('the example is a valid report in its own right', () => {
  it('parses against the stored report schema', () => {
    const parsed = marketEntryReportSchema.safeParse(EXAMPLE_DOSSIER);
    expect(parsed.success ? null : parsed.error.issues).toBeNull();
  });

  it('carries the current schema version', () => {
    expect(EXAMPLE_DOSSIER.schemaVersion).toBe(MARKET_ENTRY_SCHEMA_VERSION);
    expect(produced.schemaVersion).toBe(MARKET_ENTRY_SCHEMA_VERSION);
  });

  it('cites nothing it does not carry', () => {
    const refs = new Set(EXAMPLE_DOSSIER.sources.map((source) => source.ref));
    const cited = JSON.stringify(EXAMPLE_DOSSIER).match(/"S\d+"/g) ?? [];
    for (const citation of cited) {
      expect(refs.has(JSON.parse(citation) as string), `${citation} is dangling`).toBe(
        true,
      );
    }
  });

  it('states what it could not establish', () => {
    expect(EXAMPLE_DOSSIER.appendix.limitations.length).toBeGreaterThan(0);
  });

  it('names a fictional business, so nobody mistakes it for a real assessment', () => {
    // The page labels it illustrative; the fixture must not describe a real
    // company's market position under a real company's name.
    expect(EXAMPLE_DOSSIER.decision.businessName).toBe('Ardmore Sea Salt');
    for (const source of EXAMPLE_DOSSIER.sources) {
      expect(new URL(source.url).hostname.endsWith('.example')).toBe(true);
    }
  });
});
