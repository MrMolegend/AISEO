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
  getShareLinkStore,
  resetShareLinkStoreCache,
  resetMemoryShareStore,
} from '@/lib/share/store';
import { resolveSharedAccess, authoriseExport } from '@/lib/share/authorize';
import { mintShareToken } from '@/lib/share/tokens';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';

/**
 * The sharing boundary, end to end on the memory drivers.
 *
 * What must hold: a live token opens exactly its own report; every dead or
 * wrong token is the same SHARE_LINK_INVALID; downloads need the extra
 * permission; and the owner's path never depends on any of it.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  resetMemoryJobStore();
  resetMemoryWallet();
  resetMemoryShareStore();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetShareLinkStoreCache();
  resetResearchProviderCache();
  resetRateLimiter();
  FixtureResearchProvider.reset();
});

afterEach(() => {
  FixtureResearchProvider.reset();
});

async function completedJob() {
  const wallet = await getTokenWallet();
  await wallet.bootstrap(OWNER, { welcomeTokens: 0 });
  await wallet.grant({
    userId: OWNER,
    amount: 500,
    type: 'admin_grant',
    idempotencyKey: `grant:share-${crypto.randomUUID()}`,
    description: 'Test funding',
  });
  const created = await createResearchJob({
    userId: OWNER,
    body: { ...EXAMPLE_SUBMISSION },
    submissionId: `share-${crypto.randomUUID()}`,
    ipHash: null,
  });
  await runResearchJob(created.job);
  const store = await getResearchJobStore();
  return (await store.getForUser(created.job.publicId, OWNER))!;
}

describe('resolveSharedAccess', () => {
  it('opens exactly the shared report for a live token', async () => {
    const job = await completedJob();
    const shares = await getShareLinkStore();
    const { rawToken } = await shares.create(OWNER, { jobId: job.id });

    const access = await resolveSharedAccess(rawToken, 'ip-1');
    expect(access.job.publicId).toBe(job.publicId);
  });

  it('answers every dead token identically', async () => {
    const job = await completedJob();
    const shares = await getShareLinkStore();

    // Revoked.
    const revoked = await shares.create(OWNER, { jobId: job.id });
    await shares.revoke(revoked.share.id, OWNER);
    // Never existed, but well-formed.
    const unknown = mintShareToken();
    // Junk.
    const junk = 'short';

    for (const token of [revoked.rawToken, unknown, junk]) {
      await expect(resolveSharedAccess(token, 'ip-1')).rejects.toMatchObject({
        code: 'SHARE_LINK_INVALID',
      });
    }
  });

  it('rate limits token attempts by presenting address', async () => {
    await completedJob();
    const attempts = Array.from({ length: 70 }, () =>
      resolveSharedAccess(mintShareToken(), 'ip-guesser').catch(
        (error: { code: string }) => error.code,
      ),
    );
    const outcomes = await Promise.all(attempts);
    expect(outcomes).toContain('RATE_LIMITED');
  });
});

describe('authoriseExport', () => {
  it('always serves the owner, with or without any token', async () => {
    const job = await completedJob();
    const served = await authoriseExport({
      publicId: job.publicId,
      userId: OWNER,
      shareToken: null,
      ipHash: null,
    });
    expect(served.id).toBe(job.id);
  });

  it('serves a visitor only through a live token minted with downloads on', async () => {
    const job = await completedJob();
    const shares = await getShareLinkStore();

    const withDownload = await shares.create(OWNER, {
      jobId: job.id,
      allowDownload: true,
    });
    const withoutDownload = await shares.create(OWNER, { jobId: job.id });

    const served = await authoriseExport({
      publicId: job.publicId,
      userId: null,
      shareToken: withDownload.rawToken,
      ipHash: 'ip-2',
    });
    expect(served.id).toBe(job.id);

    await expect(
      authoriseExport({
        publicId: job.publicId,
        userId: null,
        shareToken: withoutDownload.rawToken,
        ipHash: 'ip-2',
      }),
    ).rejects.toMatchObject({ code: 'SHARE_LINK_INVALID' });
  });

  it('a token never opens a report other than its own', async () => {
    const jobA = await completedJob();
    const shares = await getShareLinkStore();
    const { rawToken } = await shares.create(OWNER, {
      jobId: jobA.id,
      allowDownload: true,
    });

    // Presented against a different public id, the token is refused even
    // though it is live and download-enabled: the share names one report.
    await expect(
      authoriseExport({
        publicId: 'someOtherReport1',
        userId: null,
        shareToken: rawToken,
        ipHash: 'ip-3',
      }),
    ).rejects.toMatchObject({ code: 'SHARE_LINK_INVALID' });
  });

  it('with neither a session nor a token there is nothing to serve', async () => {
    const job = await completedJob();
    await expect(
      authoriseExport({
        publicId: job.publicId,
        userId: null,
        shareToken: null,
        ipHash: null,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
