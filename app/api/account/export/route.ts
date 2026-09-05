import { requireUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getBusinessProfileStore } from '@/lib/profiles/store';
import { getResearchDraftStore } from '@/lib/drafts/store';
import { getReportScenarioStore } from '@/lib/scenarios/store';
import { getActionItemStore } from '@/lib/actions/store';
import { getReportFeedbackStore } from '@/lib/feedback/store';
import { getShareLinkStore } from '@/lib/share/store';
import { getTokenWallet } from '@/lib/tokens';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * The take-it-with-you export.
 *
 * Everything the platform holds for this account, as one JSON document:
 * profiles, drafts, assessments with their reports and sources, scenarios,
 * actions, feedback, share-link metadata, and the credit ledger. Owner-
 * scoped read-for-read — every store call carries the caller's id.
 *
 * What is deliberately absent: share-token hashes (metadata only — a hash
 * is not the user's data, it is the lock on it) and anything belonging to
 * another account.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await requireUser();

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`account-export:${user.id}`, 6, 3_600));

    const [jobs, profiles, drafts, actions, wallet] = await Promise.all([
      (await getResearchJobStore()).listForUser(user.id, 100),
      (await getBusinessProfileStore()).listForUser(user.id, {
        includeArchived: true,
        limit: 100,
      }),
      (await getResearchDraftStore()).listForUser(user.id, 50),
      (await getActionItemStore()).listForUser(user.id, { limit: 500 }),
      getTokenWallet(),
    ]);

    const scenarioStore = await getReportScenarioStore();
    const feedbackStore = await getReportFeedbackStore();
    const scenarios = (
      await Promise.all(jobs.map((job) => scenarioStore.listForJob(user.id, job.id)))
    ).flat();
    const feedback = (
      await Promise.all(jobs.map((job) => feedbackStore.getForUser(user.id, job.id)))
    ).filter(Boolean);

    const shares = await (await getShareLinkStore()).listForUser(user.id, 200);
    const [balance, ledger] = await Promise.all([
      wallet.getBalance(user.id),
      wallet.history(user.id, 500),
    ]);

    const bundle = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email },
      businessProfiles: profiles,
      drafts,
      assessments: jobs.map((job) => ({
        publicId: job.publicId,
        status: job.status,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        brief: job.input,
        report: job.report,
        sources: job.sources,
        errorCode: job.errorCode,
      })),
      scenarios,
      actions,
      feedback,
      shareLinks: shares.map((share) => ({
        // Metadata only: the token was never stored and the hash is a lock,
        // not a record.
        label: share.label,
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        revokedAt: share.revokedAt,
        useCount: share.useCount,
        lastUsedAt: share.lastUsedAt,
      })),
      credits: { balance, ledger },
    };

    return new Response(JSON.stringify(bundle, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="corridor-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
