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
import { isTerminal } from '@/lib/jobs/stages';
import { REPORT_TOKEN_COST, formatCredits } from '@/config/report';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';

/**
 * The money path, end to end, on the in-memory drivers.
 *
 * These are the tests that matter most in this codebase. Everything else can be
 * wrong and be embarrassing; this being wrong takes tokens from someone and
 * gives nothing back, or gives a report away for free. So each one asserts the
 * *balance and the ledger*, not just the returned status — a job can look
 * correct and still have left a hold stranded.
 *
 * No network and no paid calls: the research provider is the deterministic mock
 * and the synthesiser is the fixture one, both selected automatically because
 * no credentials are configured under test.
 */

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';

/*
 * The brief, as the four-stage intake produces it.
 *
 * There is no website field and no crawl to stub: the previous version of this
 * file mocked a whole site fetch so the pipeline had something to read, which
 * is exactly the dependency this product removed. Research now comes entirely
 * from the deterministic fixture provider, so nothing here touches DNS and a
 * failure below always means what it says.
 */
const BRIEF = () => ({ ...EXAMPLE_SUBMISSION });

const COST = REPORT_TOKEN_COST;

let submissionCounter = 0;
/** A fresh, valid submission id. Distinct ids mean distinct reservations. */
function newSubmissionId(): string {
  submissionCounter += 1;
  return `submission-${String(submissionCounter).padStart(6, '0')}`;
}

async function fund(userId: string, amount: number) {
  const wallet = await getTokenWallet();
  await wallet.bootstrap(userId, { welcomeTokens: 0 });
  await wallet.grant({
    userId,
    amount,
    type: 'admin_grant',
    idempotencyKey: `grant:test-${userId}-${amount}-${submissionCounter}`,
    description: 'Test funding',
  });
}

async function balanceOf(userId: string) {
  return (await getTokenWallet()).getBalance(userId);
}

function submit(overrides: Record<string, unknown> = {}, userId = USER) {
  return createResearchJob({
    userId,
    body: { ...BRIEF(), ...overrides },
    submissionId: newSubmissionId(),
    ipHash: null,
  });
}

beforeEach(() => {
  // Both memory drivers keep their state on a module-level symbol so that a
  // reload of the module does not silently start a second, empty wallet. That
  // makes clearing it an explicit step rather than a side effect of a reset.
  resetMemoryJobStore();
  resetMemoryWallet();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetResearchProviderCache();
  resetRateLimiter();
  FixtureResearchProvider.reset();
});

afterEach(() => {
  FixtureResearchProvider.reset();
});

describe('a research job that succeeds', () => {
  it('charges exactly the catalogue price, once, and leaves no hold behind', async () => {
    await fund(USER, 500);

    const created = await submit();
    expect(created.cached).toBe(false);
    expect(created.job.tokenCost).toBe(COST);

    // Reserved, not yet spent: the report does not exist.
    const held = await balanceOf(USER);
    expect(held.available).toBe(500 - COST);
    expect(held.reserved).toBe(COST);

    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);
    expect(job?.status).toBe('complete');
    expect(job?.report).toBeTruthy();

    const after = await balanceOf(USER);
    expect(after.available).toBe(500 - COST);
    // The hold became a spend. A non-zero reserved here is the bug this
    // assertion exists for: the user cannot spend tokens stuck in a hold.
    expect(after.reserved).toBe(0);

    const ledger = await (await getTokenWallet()).history(USER, 20);
    const forJob = ledger.filter((entry) => entry.jobId === created.job.id);
    expect(forJob.map((entry) => entry.type).sort()).toEqual(['debit', 'reservation']);
    // Signed amounts sum to the single charge, whatever order they are read in.
    expect(forJob.reduce((sum, entry) => sum + entry.amount, 0)).toBe(-COST);
  });

  it('reports done to the polling endpoint the moment the report exists', async () => {
    await fund(USER, 500);
    const created = await submit();
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);

    /*
     * This looked like a cosmetic ordering detail and was not.
     *
     * The runner used to write the 'settling' stage after `complete`, and every
     * stage maps to a non-terminal status — so a finished job reverted to
     * "still working". The status endpoint reports `done: isTerminal(status)`,
     * so the browser polled forever on a report that existed and had been paid
     * for. Both the runner's ordering and the store's terminal guard are
     * asserted here, from the value the endpoint actually reads.
     */
    expect(isTerminal(job!.status)).toBe(true);

    // And a late stage write — an abandoned run, a retry — cannot undo it.
    await store.setStage(created.job.id, 'strategy');
    const after = await store.getForUser(created.job.publicId, USER);
    expect(after?.status).toBe('complete');
    expect(isTerminal(after!.status)).toBe(true);
  });

  it('stores a source for every citation the report is allowed to make', async () => {
    await fund(USER, 500);
    const created = await submit();
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);

    expect(job?.sources.length).toBeGreaterThanOrEqual(3);
    // Stable, contiguous refs. The report cites S1..Sn and nothing else.
    expect(job?.sources.map((source) => source.ref)).toEqual(
      job?.sources.map((_, index) => `S${index + 1}`),
    );
  });
});

describe('pricing', () => {
  it('ignores a price supplied by the client', async () => {
    await fund(USER, 500);

    // Every plausible way a client might try to name its own price.
    const created = await submit({
      tokenCost: 1,
      token_cost: 1,
      price: 1,
      cost: 1,
    });

    expect(created.job.tokenCost).toBe(COST);
    expect((await balanceOf(USER)).reserved).toBe(COST);
  });

  it('refuses a package the balance cannot cover, without creating a job', async () => {
    await fund(USER, COST - 1);

    await expect(submit()).rejects.toMatchObject({ code: 'INSUFFICIENT_TOKENS' });

    const store = await getResearchJobStore();
    expect(await store.listForUser(USER, 10)).toHaveLength(0);
    expect(await balanceOf(USER)).toEqual({ available: COST - 1, reserved: 0 });
  });

  it('rejects an unknown package before touching the wallet', async () => {
    await fund(USER, 500);

    await expect(submit({ packageId: 'free-everything' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(await balanceOf(USER)).toEqual({ available: 500, reserved: 0 });
  });
});

describe('a research job that fails', () => {
  it('returns the tokens when the failure is ours', async () => {
    await fund(USER, 500);
    const created = await submit();

    FixtureResearchProvider.fault = 'unavailable';
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);
    expect(job?.status).toBe('failed');

    // Whole balance back, nothing held.
    expect(await balanceOf(USER)).toEqual({ available: 500, reserved: 0 });

    const ledger = await (await getTokenWallet()).history(USER, 20);
    const forJob = ledger.filter((entry) => entry.jobId === created.job.id);
    expect(forJob.map((entry) => entry.type).sort()).toEqual(['refund', 'reservation']);
    expect(forJob.reduce((sum, entry) => sum + entry.amount, 0)).toBe(0);
  });

  it('returns the tokens when there was nothing to build a report from', async () => {
    await fund(USER, 500);
    const created = await submit();

    // The provider is working; there is simply nothing published. The rule is
    // about what was *delivered*, not how much was found: a completed report
    // is charged however thin it turns out to be, but a run that produces no
    // report at all cannot be charged for.
    FixtureResearchProvider.fault = 'empty';
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);
    expect(job?.status).toBe('failed');
    expect(job?.errorCode).toBe('NO_RELIABLE_SOURCES');
    expect(job?.report).toBeNull();

    expect(await balanceOf(USER)).toEqual({ available: 500, reserved: 0 });
  });

  it('cannot refund twice, however many times the failure path runs', async () => {
    await fund(USER, 500);
    const created = await submit();

    FixtureResearchProvider.fault = 'unavailable';
    await runResearchJob(created.job);
    await runResearchJob(created.job);
    await runResearchJob(created.job);

    // Not 500 + 2×COST. The idempotency key and the settle-once rule both hold.
    expect(await balanceOf(USER)).toEqual({ available: 500, reserved: 0 });
  });
});

describe('duplicate submissions', () => {
  it('charges one click once, however many times it arrives', async () => {
    await fund(USER, 500);
    const submissionId = newSubmissionId();

    const first = await createResearchJob({
      userId: USER,
      body: BRIEF(),
      submissionId,
      ipHash: null,
    });

    await expect(
      createResearchJob({ userId: USER, body: BRIEF(), submissionId, ipHash: null }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_SUBMISSION' });

    // One hold, not two.
    expect(await balanceOf(USER)).toEqual({
      available: 500 - COST,
      reserved: COST,
    });

    // And the orphaned second row is failed rather than left runnable.
    const store = await getResearchJobStore();
    const jobs = await store.listForUser(USER, 10);
    expect(jobs).toHaveLength(2);
    expect(jobs.filter((job) => job.status === 'failed')).toHaveLength(1);
    expect(jobs.find((job) => job.id === first.job.id)?.status).toBe('queued');
  });
});

describe('the cache', () => {
  it('returns an identical recent report free of charge, marked as cached', async () => {
    await fund(USER, 500);

    const first = await submit();
    await runResearchJob(first.job);

    const balanceAfterFirst = await balanceOf(USER);

    const second = await submit();
    expect(second.cached).toBe(true);
    expect(second.job.publicId).toBe(first.job.publicId);

    // Not a token moved.
    expect(await balanceOf(USER)).toEqual(balanceAfterFirst);
  });

  it('does not serve one account a report generated for another', async () => {
    await fund(USER, 500);
    await fund(OTHER_USER, 500);

    const first = await submit();
    await runResearchJob(first.job);

    const second = await submit({}, OTHER_USER);
    expect(second.cached).toBe(false);
    expect(second.job.publicId).not.toBe(first.job.publicId);
    // The second account paid, because it got its own run.
    expect((await balanceOf(OTHER_USER)).reserved).toBe(COST);
  });
});

describe('access', () => {
  it('will not return another account’s job to a private read', async () => {
    await fund(USER, 500);
    const created = await submit();
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    expect(await store.getForUser(created.job.publicId, OTHER_USER)).toBeNull();
    expect(await store.getForUser(created.job.publicId, USER)).not.toBeNull();
  });

  it('serves a completed report to anyone holding the link', async () => {
    await fund(USER, 500);
    const created = await submit();
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const shared = await store.getPublic(created.job.publicId);
    expect(shared?.publicId).toBe(created.job.publicId);
    expect(shared?.report).toBeTruthy();
  });

  it('does not expose a job that has not completed', async () => {
    await fund(USER, 500);
    const created = await submit();

    const store = await getResearchJobStore();
    expect(await store.getPublic(created.job.publicId)).toBeNull();
  });
});

describe('the price', () => {
  it("is the server's, and the request cannot name one", async () => {
    // There is one product and one cost. The body below tries to buy a report
    // for nothing; the reservation is for the full amount regardless, because
    // create-job never reads a price off the request.
    await fund(USER, COST * 2);

    const created = await submit({ tokenCost: 0, packageId: 'market-entry' });

    expect(created.job.tokenCost).toBe(COST);
    expect(created.tokensReserved).toBe(COST);
  });

  it('is never shown to a customer as a token count', () => {
    // The internal cost is a hundred tokens; the customer is told about one
    // report credit. formatCredits is the only conversion, and it never
    // renders the underlying number.
    expect(formatCredits(COST)).toBe('1 report credit');
    expect(formatCredits(COST * 3)).toBe('3 report credits');
    expect(formatCredits(COST - 1)).toBe('0 report credits');
    expect(formatCredits(COST * 3)).not.toContain('300');
  });
});
