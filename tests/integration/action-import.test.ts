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
  getActionItemStore,
  resetActionItemStoreCache,
  resetMemoryActionStore,
} from '@/lib/actions/store';
import { importPlanActions } from '@/lib/actions/import';
import { marketEntryReportSchema } from '@/schemas/market-entry/report';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';

/**
 * Report plan → workspace, end to end on the memory drivers: one row per
 * recommendation, convergent on retry, edits preserved across re-imports,
 * and no path to import from a report that is not yours.
 */

const USER = '11111111-1111-4111-8111-111111111111';
const INTRUDER = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  resetMemoryJobStore();
  resetMemoryWallet();
  resetMemoryActionStore();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetActionItemStoreCache();
  resetResearchProviderCache();
  resetRateLimiter();
  FixtureResearchProvider.reset();
});

afterEach(() => {
  FixtureResearchProvider.reset();
});

async function completedJob() {
  const wallet = await getTokenWallet();
  await wallet.bootstrap(USER, { welcomeTokens: 0 });
  await wallet.grant({
    userId: USER,
    amount: 500,
    type: 'admin_grant',
    idempotencyKey: `grant:import-${Date.now()}`,
    description: 'Test funding',
  });

  const created = await createResearchJob({
    userId: USER,
    body: { ...EXAMPLE_SUBMISSION },
    submissionId: `import-${crypto.randomUUID()}`,
    ipHash: null,
  });
  await runResearchJob(created.job);
  const store = await getResearchJobStore();
  const job = await store.getForUser(created.job.publicId, USER);
  expect(job?.status).toBe('complete');
  return job!;
}

describe('importing a report plan', () => {
  it('creates one action per recommendation and converges on retry', async () => {
    const job = await completedJob();
    const report = marketEntryReportSchema.parse(job.report);

    const first = await importPlanActions(USER, job);
    expect(first.imported).toHaveLength(report.plan.actions.length);

    // Press the button again: same rows, no duplicates.
    const second = await importPlanActions(USER, job);
    expect(second.imported.map((action) => action.id).sort()).toEqual(
      first.imported.map((action) => action.id).sort(),
    );

    const store = await getActionItemStore();
    expect(await store.listForUser(USER, { jobId: job.id })).toHaveLength(
      report.plan.actions.length,
    );
  });

  it('leaves customer edits alone when the import is retried', async () => {
    const job = await completedJob();
    const { imported } = await importPlanActions(USER, job);

    const store = await getActionItemStore();
    const edited = await store.update(imported[0]!.id, USER, {
      title: 'My reworded version',
      status: 'done',
    });
    expect(edited?.title).toBe('My reworded version');

    await importPlanActions(USER, job);

    const after = await store.getForUser(imported[0]!.id, USER);
    expect(after?.title).toBe('My reworded version');
    expect(after?.status).toBe('done');
  });

  it('carries phase, priority and a link back to the plan', async () => {
    const job = await completedJob();
    const report = marketEntryReportSchema.parse(job.report);
    const { imported } = await importPlanActions(USER, job);

    const original = report.plan.actions[0]!;
    const row = imported.find((action) => action.sourceActionId === original.id);
    expect(row).toBeDefined();
    expect(row?.phase).toBe(original.phase);
    expect(row?.priority).toBe(original.priority);
    expect(row?.evidence[0]?.sectionId).toBe('plan');
  });

  it('refuses another user’s job outright', async () => {
    const job = await completedJob();
    await expect(importPlanActions(INTRUDER, job)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const store = await getActionItemStore();
    expect(await store.listForUser(INTRUDER)).toHaveLength(0);
  });
});
