import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createResearchJob } from '@/lib/jobs/create-job';
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
  isStalled,
  repairStalledJob,
  repairAllStalled,
  stallCutoffIso,
} from '@/lib/jobs/recovery';
import { REPORT_TOKEN_COST } from '@/config/report';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';

/**
 * Stalled-job repair: dead runs settle like any other failure — failed with
 * a refundable code, credit returned exactly once however many times repair
 * runs. Time is faked so "stalled" is a fact this file controls.
 */

const USER = '11111111-1111-4111-8111-111111111111';
const STALL_MS = 15 * 60_000;

beforeEach(() => {
  resetMemoryJobStore();
  resetMemoryWallet();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetResearchProviderCache();
  resetRateLimiter();
  FixtureResearchProvider.reset();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  FixtureResearchProvider.reset();
});

async function reservedJob() {
  const wallet = await getTokenWallet();
  await wallet.bootstrap(USER, { welcomeTokens: 0 });
  await wallet.grant({
    userId: USER,
    amount: 500,
    type: 'admin_grant',
    idempotencyKey: `grant:recovery-${crypto.randomUUID()}`,
    description: 'Test funding',
  });
  const created = await createResearchJob({
    userId: USER,
    body: { ...EXAMPLE_SUBMISSION },
    submissionId: `recovery-${crypto.randomUUID()}`,
    ipHash: null,
  });
  return created.job;
}

describe('stall detection', () => {
  it('a fresh job is not stalled; a silent one past the threshold is', async () => {
    const job = await reservedJob();
    expect(isStalled(job)).toBe(false);

    const later = Date.now() + STALL_MS + 60_000;
    expect(isStalled(job, later)).toBe(true);

    // A pulse resets the clock.
    const store = await getResearchJobStore();
    await store.touchHeartbeat(job.id);
    const pulsed = (await store.getForUser(job.publicId, USER))!;
    expect(isStalled(pulsed, Date.now() + 60_000)).toBe(false);
  });

  it('terminal jobs are never stalled', async () => {
    const job = await reservedJob();
    const store = await getResearchJobStore();
    await store.fail(job.id, 'JOB_TIMEOUT');
    const failed = (await store.getForUser(job.publicId, USER))!;
    expect(isStalled(failed, Date.now() + 10 * STALL_MS)).toBe(false);
  });
});

describe('repair', () => {
  it('fails the run with the refundable code and returns the credit once', async () => {
    const job = await reservedJob();
    const wallet = await getTokenWallet();
    expect((await wallet.getBalance(USER)).reserved).toBe(REPORT_TOKEN_COST);

    // Push the clock past the stall threshold.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + STALL_MS + 60_000);

    const first = await repairStalledJob(job);
    expect(first.repaired).toBe(true);
    expect(first.refundReplayed).toBe(false);

    const store = await getResearchJobStore();
    const settled = await store.getForUser(job.publicId, USER);
    expect(settled?.status).toBe('failed');
    expect(settled?.errorCode).toBe('JOB_STALLED');

    // The hold is gone and the balance is whole.
    expect(await wallet.getBalance(USER)).toEqual({ available: 500, reserved: 0 });

    // Repairing again — a second admin, a re-opened page — replays, never
    // double-refunds.
    const second = await repairStalledJob(settled!);
    expect(second.repaired).toBe(false);
    expect(await wallet.getBalance(USER)).toEqual({ available: 500, reserved: 0 });
  });

  it('does nothing to a run that pulsed since it was listed', async () => {
    const job = await reservedJob();
    const result = await repairStalledJob(job);
    expect(result.repaired).toBe(false);

    const store = await getResearchJobStore();
    expect((await store.getForUser(job.publicId, USER))?.status).toBe('queued');
  });

  it('the sweep repairs every stalled run and reports its arithmetic', async () => {
    const job = await reservedJob();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + STALL_MS + 60_000);

    const store = await getResearchJobStore();
    expect(await store.listStale(stallCutoffIso())).toHaveLength(1);

    const sweep = await repairAllStalled();
    expect(sweep).toEqual({ examined: 1, repaired: 1 });

    // A second sweep finds a clean floor.
    expect(await repairAllStalled()).toEqual({ examined: 0, repaired: 0 });
    void job;
  });
});
