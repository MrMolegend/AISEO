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
import {
  FixtureResearchProvider,
  fixtureRetrieval,
  resetResearchProviderCache,
} from '@/lib/research';
import { retrieveSources } from '@/lib/research/retrieve';
import { resetRateLimiter } from '@/lib/security/rate-limit';
import { REPORT_TOKEN_COST } from '@/config/report';
import { PlatformError } from '@/lib/errors';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';
import type { MarketEntryReport } from '@/schemas/market-entry/report';
import type { RetrievalTransport } from '@/lib/research/retrieve';

/**
 * The promise: external retrieval is enrichment, never a dependency.
 *
 * The previous product failed a customer's report when one page refused a
 * fetch, and it was the single worst behaviour in it — someone paid, a
 * ministry's website was slow, and they got an error. This file is what stops
 * that returning. It is deliberately extreme: not "one page failed" but "every
 * page failed", because the guarantee is only worth something at the limit.
 *
 * Three properties, in order of how much they matter:
 *
 *   1. A report is produced and charged for when *every* fetch is refused.
 *   2. A claim that needed a directly-read authority is marked unverified with
 *      the gap recorded — not dropped, not asserted anyway, not sent to repair.
 *   3. The quality gate does not fire because pages were inaccessible.
 */

const USER = '33333333-3333-4333-8333-333333333333';
const COST = REPORT_TOKEN_COST;

let counter = 0;
const nextSubmissionId = () => `best-effort-${(counter += 1)}`;

async function fund(amount: number) {
  const wallet = await getTokenWallet();
  await wallet.bootstrap(USER, { welcomeTokens: 0 });
  await wallet.grant({
    userId: USER,
    amount,
    type: 'admin_grant',
    idempotencyKey: `grant:best-effort-${counter}-${amount}`,
    description: 'Test funding',
  });
}

async function runOne(): Promise<{ report: MarketEntryReport; publicId: string }> {
  const created = await createResearchJob({
    userId: USER,
    body: { ...EXAMPLE_SUBMISSION },
    submissionId: nextSubmissionId(),
    ipHash: null,
  });
  await runResearchJob(created.job);

  const store = await getResearchJobStore();
  const job = await store.getForUser(created.job.publicId, USER);
  expect(job?.status, job?.errorCode ?? 'no error').toBe('complete');
  return { report: job!.report as MarketEntryReport, publicId: created.job.publicId };
}

beforeEach(async () => {
  resetMemoryJobStore();
  resetMemoryWallet();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetResearchProviderCache();
  resetRateLimiter();
  FixtureResearchProvider.reset();
  await fund(1000);
});

afterEach(() => {
  FixtureResearchProvider.reset();
});

describe('a report survives every page refusing us', () => {
  it('completes, is charged for, and records what it could not read', async () => {
    fixtureRetrieval.fault = 'all-blocked';

    const { report } = await runOne();

    // Nothing was read directly, and the report says so rather than hiding it.
    expect(report.coverage.directlyRetrieved).toBe(0);
    expect(report.coverage.blocked.length).toBeGreaterThan(0);
    expect(report.coverage.fromIndexOnly).toBe(report.coverage.sourcesAccepted);

    // And the customer was charged normally: they got a document.
    const balance = await (await getTokenWallet()).getBalance(USER);
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(1000 - COST);
  });

  it('marks the claims that needed an authority as unverified, and says why', async () => {
    fixtureRetrieval.fault = 'all-blocked';

    const { report } = await runOne();

    // A regulatory claim cannot rest on an indexed snippet. With nothing read
    // directly, every regulatory grade must be `unknown` — never `verified`.
    const regulatoryGrades = Object.entries(report.grades)
      .filter(([path]) => path.startsWith('regulation.'))
      .map(([, grade]) => grade);

    expect(regulatoryGrades.length).toBeGreaterThan(0);
    expect(regulatoryGrades).not.toContain('verified');

    // The gap is stated rather than left for the reader to notice.
    expect(report.appendix.limitations.length).toBeGreaterThan(0);
  });

  it('does not fail the quality gate because pages were inaccessible', async () => {
    // The report is otherwise identical to the passing one. If retrieval
    // failure could fire the gate, this would be a refund.
    fixtureRetrieval.fault = 'all-blocked';
    const { report } = await runOne();

    const store = await getResearchJobStore();
    const jobs = await store.listForUser(USER, 5);
    expect(jobs[0]?.errorCode).toBeNull();
    expect(report.decision.verdict).not.toBe('insufficient-evidence');
  });

  it('scores lower than the same research with pages read — worse, not fatal', async () => {
    fixtureRetrieval.fault = 'all-blocked';
    const blind = await runOne();

    FixtureResearchProvider.reset();
    resetResearchProviderCache();
    const seeing = await runOne();

    expect(seeing.report.coverage.directlyRetrieved).toBeGreaterThan(0);
    expect(blind.report.decision.readiness).toBeLessThan(
      seeing.report.decision.readiness,
    );
  });
});

describe('retrieveSources never throws, whatever the page does', () => {
  const transport = (fetchPage: RetrievalTransport['fetchPage']): RetrievalTransport => ({
    fetchPage,
    robotsAllows: async () => true,
  });

  const urls = [
    'https://a.example/one',
    'https://b.example/two',
    'https://c.example/three',
  ];

  it.each([
    ['a robots refusal', new PlatformError('ROBOTS_DISALLOWED', 'no')],
    ['a site block', new PlatformError('SITE_BLOCKED', 'no')],
    ['a timeout', new PlatformError('SITE_TIMEOUT', 'no')],
    ['an oversized page', new PlatformError('SITE_TOO_LARGE', 'no')],
    ['a non-HTML response', new PlatformError('NOT_HTML', 'no')],
    ['an ordinary Error', new Error('socket hang up')],
    ['a thrown string', 'something threw a string'],
  ])('records %s and carries on', async (_label, thrown) => {
    const outcome = await retrieveSources(urls, new AbortController().signal, {
      transport: transport(async () => {
        throw thrown;
      }),
    });

    expect(outcome.retrieved).toEqual([]);
    expect(outcome.blocked).toHaveLength(urls.length);
    expect(outcome.stats.attempted).toBe(urls.length);
  });

  it('records a robots refusal without requesting the page', async () => {
    let requested = 0;
    const outcome = await retrieveSources(urls, new AbortController().signal, {
      transport: {
        fetchPage: async () => {
          requested += 1;
          throw new Error('should never be called');
        },
        robotsAllows: async () => false,
      },
    });

    expect(requested).toBe(0);
    expect(outcome.blocked.map((entry) => entry.reason)).toEqual([
      'robots-disallowed',
      'robots-disallowed',
      'robots-disallowed',
    ]);
  });

  it('never requests a platform whose terms forbid it', async () => {
    const requested: string[] = [];
    const outcome = await retrieveSources(
      [
        'https://www.linkedin.com/company/example',
        'https://www.instagram.com/example/',
        'https://www.facebook.com/example',
        'https://www.tiktok.com/@example',
        'https://x.com/example',
        'https://twitter.com/example',
      ],
      new AbortController().signal,
      {
        transport: {
          fetchPage: async (url) => {
            requested.push(url);
            throw new Error('should never be called');
          },
          robotsAllows: async () => {
            requested.push('robots');
            return true;
          },
        },
      },
    );

    // Not fetched, not even robots-checked: refused on policy before any
    // request is made, and still citable from the index.
    expect(requested).toEqual([]);
    expect(outcome.blocked.map((entry) => entry.reason)).toEqual(
      Array(6).fill('platform-policy'),
    );
    expect(outcome.stats.attempted).toBe(0);
  });

  it('keeps going after a failure to reach a page that works', async () => {
    const outcome = await retrieveSources(urls, new AbortController().signal, {
      transport: transport(async (url) => {
        if (url !== 'https://c.example/three') {
          throw new PlatformError('SITE_TIMEOUT', 'no');
        }
        return {
          finalUrl: url,
          status: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html><head><title>Third</title></head><body><p>Read.</p></body></html>',
          bytes: 80,
          encodedBytes: 80,
          encoding: 'identity',
          redirectChain: [],
          responseTimeMs: 1,
          truncated: false,
        };
      }),
    });

    // The one page that answered is the one page we got. A single early
    // failure aborting the loop is precisely the bug this guards.
    expect(outcome.retrieved.map((page) => page.url)).toEqual([
      'https://c.example/three',
    ]);
    expect(outcome.blocked).toHaveLength(2);
  });

  it('budgets attempts rather than successes, so dead hosts cannot overrun it', async () => {
    let attempts = 0;
    const many = Array.from({ length: 40 }, (_, index) => `https://p${index}.example/x`);

    const outcome = await retrieveSources(many, new AbortController().signal, {
      transport: transport(async () => {
        attempts += 1;
        throw new PlatformError('SITE_TIMEOUT', 'no');
      }),
      budget: {
        maxFetches: 5,
        maxTotalBytes: 8_000_000,
        maxDurationMs: 45_000,
        maxPerPublisher: 2,
        concurrency: 3,
      },
    });

    expect(attempts).toBe(5);
    expect(outcome.stats.stoppedBecause).toBe('page-budget');
  });

  it('stops cleanly when the job is cancelled', async () => {
    const controller = new AbortController();
    controller.abort();

    const outcome = await retrieveSources(urls, controller.signal, {
      transport: transport(async () => {
        throw new Error('should never be called');
      }),
    });

    expect(outcome.stats.stoppedBecause).toBe('aborted');
    expect(outcome.retrieved).toEqual([]);
  });
});
