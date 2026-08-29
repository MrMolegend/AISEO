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
import { FixtureSynthesiser } from '@/lib/ai/fixture-synthesiser';
import { resetRateLimiter } from '@/lib/security/rate-limit';
import { getEnv, resetEnvCache } from '@/lib/env';
import { REPORT_TOKEN_COST, SEARCH_BUDGET } from '@/config/report';
import { ERROR_COPY } from '@/lib/errors';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';
import type { MarketEntryReport } from '@/schemas/market-entry/report';

/**
 * The market-entry job, end to end, with the money asserted at every exit.
 *
 * The rule the whole file is about: **tokens are only permanently deducted for
 * a usable report.** A reservation is taken before the work starts, and exactly
 * one of two things happens to it — it is finalised after the quality gate
 * passes, or it is refunded. Never neither, never both, never twice.
 *
 * Every assertion checks the balance *and* the ledger, because a job can look
 * correct and still have left a hold stranded, and a stranded hold is money the
 * customer cannot spend and cannot see.
 */

const USER = '55555555-5555-4555-8555-555555555555';
const COST = REPORT_TOKEN_COST;

let counter = 0;
const nextSubmissionId = () => `lifecycle-${(counter += 1)}`;

async function fund(amount: number) {
  const wallet = await getTokenWallet();
  await wallet.bootstrap(USER, { welcomeTokens: 0 });
  await wallet.grant({
    userId: USER,
    amount,
    type: 'admin_grant',
    idempotencyKey: `grant:lifecycle-${counter}-${amount}`,
    description: 'Test funding',
  });
}

const balance = async () => (await getTokenWallet()).getBalance(USER);

async function ledgerFor(jobId: string) {
  const entries = await (await getTokenWallet()).history(USER, 50);
  return entries.filter((entry) => entry.jobId === jobId);
}

async function submit() {
  return createResearchJob({
    userId: USER,
    body: { ...EXAMPLE_SUBMISSION },
    submissionId: nextSubmissionId(),
    ipHash: null,
  });
}

beforeEach(async () => {
  resetMemoryJobStore();
  resetMemoryWallet();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetResearchProviderCache();
  resetRateLimiter();
  resetEnvCache();
  FixtureResearchProvider.reset();
  FixtureSynthesiser.reset();
  await fund(1000);
});

afterEach(() => {
  FixtureResearchProvider.reset();
  FixtureSynthesiser.reset();
  resetEnvCache();
});

describe('a report that clears the gate', () => {
  it('charges once, after the gate and not before', async () => {
    const created = await submit();

    // Held, not spent: no report exists yet.
    expect(await balance()).toEqual({ available: 1000 - COST, reserved: COST });

    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);
    expect(job?.status).toBe('complete');

    expect(await balance()).toEqual({ available: 1000 - COST, reserved: 0 });
    const ledger = await ledgerFor(created.job.id);
    expect(ledger.map((entry) => entry.type).sort()).toEqual(['debit', 'reservation']);
    expect(ledger.reduce((sum, entry) => sum + entry.amount, 0)).toBe(-COST);
  });

  it('records the search spend it actually made, within the server-side caps', async () => {
    const created = await submit();
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);
    const meta = job?.meta as Record<string, number> | null;

    expect(meta?.searchesAdvanced ?? 0).toBeLessThanOrEqual(SEARCH_BUDGET.advanced);
    expect(meta?.searchesBasic ?? 0).toBeLessThanOrEqual(SEARCH_BUDGET.basic);
    expect(
      (meta?.searchesAdvanced ?? 0) + (meta?.searchesBasic ?? 0),
    ).toBeLessThanOrEqual(SEARCH_BUDGET.total);

    // And the provider was not called more times than the plan granted.
    expect(FixtureResearchProvider.queries.length).toBeLessThanOrEqual(
      SEARCH_BUDGET.total,
    );
  });

  it('stores the observability record without any cost figure a customer could see', async () => {
    const created = await submit();
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);
    const meta = job?.meta as Record<string, unknown> | null;

    expect(meta?.qualityGate).toBe('passed');
    expect(meta?.settlement).toBe('finalised');
    expect(meta?.creditReservedTokens).toBe(COST);

    /*
     * The token vocabulary lives in the operational record, never in the
     * document. Checked as a word rather than as the number 100, because "100"
     * legitimately appears in prose about grams and prices — searching for the
     * digits would fail on a sentence about packaging.
     */
    const report = job?.report as MarketEntryReport;
    expect(JSON.stringify(report)).not.toMatch(/token/i);
    expect(JSON.stringify(report)).not.toMatch(/\bcredits?\b/i);
  });
});

describe('a report that fails the gate', () => {
  /** One content farm has republished everything: nothing corroborates. */
  const uncorroboratedMarket = () => {
    FixtureResearchProvider.fault = 'single-publisher';
  };

  it('fails with INSUFFICIENT_MARKET_EVIDENCE and refunds automatically', async () => {
    uncorroboratedMarket();
    const created = await submit();
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);

    expect(job?.status).toBe('failed');
    expect(job?.errorCode).toBe('INSUFFICIENT_MARKET_EVIDENCE');
    expect(job?.report).toBeNull();

    // Every token back, nothing held. The customer is not charged for a
    // document they were never given.
    expect(await balance()).toEqual({ available: 1000, reserved: 0 });

    const ledger = await ledgerFor(created.job.id);
    expect(ledger.map((entry) => entry.type).sort()).toEqual(['refund', 'reservation']);
    expect(ledger.reduce((sum, entry) => sum + entry.amount, 0)).toBe(0);
  });

  it('is classified as retryable and refundable in the error taxonomy', () => {
    // The refund is driven off this table rather than off a branch in the
    // runner, so the two can never disagree about what gets money back.
    expect(ERROR_COPY.INSUFFICIENT_MARKET_EVIDENCE).toMatchObject({
      retryable: true,
      refundsTokens: true,
      status: 422,
    });
  });

  it('never double-refunds, however many times the failure path runs', async () => {
    uncorroboratedMarket();
    const created = await submit();

    await runResearchJob(created.job);
    await runResearchJob(created.job);
    await runResearchJob(created.job);

    expect(await balance()).toEqual({ available: 1000, reserved: 0 });
    const ledger = await ledgerFor(created.job.id);
    expect(ledger.filter((entry) => entry.type === 'refund')).toHaveLength(1);
  });

  it('lets the customer retry without being charged for the first attempt', async () => {
    uncorroboratedMarket();
    const failed = await submit();
    await runResearchJob(failed.job);
    expect(await balance()).toEqual({ available: 1000, reserved: 0 });

    // Same inputs, a working market this time.
    FixtureResearchProvider.reset();
    const retried = await submit();
    await runResearchJob(retried.job);

    const store = await getResearchJobStore();
    expect((await store.getForUser(retried.job.publicId, USER))?.status).toBe('complete');

    // Charged exactly once across both attempts.
    expect(await balance()).toEqual({ available: 1000 - COST, reserved: 0 });
  });

  it('does not finalise a reservation for a report it never produced', async () => {
    uncorroboratedMarket();
    const created = await submit();
    await runResearchJob(created.job);

    const ledger = await ledgerFor(created.job.id);
    expect(ledger.some((entry) => entry.type === 'debit')).toBe(false);
  });
});

describe('production refuses to run on fixtures', () => {
  it('will not create a job when the research providers are not real', async () => {
    // The gate is the second lock. This is the first: on a deployment real
    // customers reach, a job that would be built from fixtures does not start,
    // so no reservation is taken and nothing has to be refunded.
    process.env.VERCEL_ENV = 'production';
    resetEnvCache();
    resetResearchProviderCache();

    try {
      expect(getEnv().VERCEL_ENV).toBe('production');
      await expect(submit()).rejects.toMatchObject({
        code: 'RESEARCH_PROVIDER_UNAVAILABLE',
      });

      // Not a token moved, and no job row left behind.
      expect(await balance()).toEqual({ available: 1000, reserved: 0 });
      const store = await getResearchJobStore();
      expect(await store.listForUser(USER, 10)).toHaveLength(0);
    } finally {
      delete process.env.VERCEL_ENV;
      resetEnvCache();
    }
  });
});
