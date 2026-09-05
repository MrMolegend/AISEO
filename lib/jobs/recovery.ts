import 'server-only';
import { getResearchJobStore, type ResearchJobRecord } from '@/lib/jobs/store';
import { getTokenWallet } from '@/lib/tokens';
import { refundKey } from '@/lib/tokens/idempotency';
import { getEnv } from '@/lib/env';
import { isTerminal } from '@/lib/jobs/stages';
import { logger } from '@/lib/observability/logger';

/**
 * Stalled-job repair.
 *
 * A job whose last pulse is older than the stall threshold is not slow, it
 * is dead — the process that was running it is gone, and nothing will ever
 * finish it. Repair is the same settlement every other failure gets: mark it
 * failed with the refundable JOB_STALLED code and put the credit back
 * through the ledger's idempotent refund. Exactly-once is the ledger's
 * property — repairing twice, or repairing concurrently with a late
 * settlement from the dying run itself, replays the same refund key and
 * moves nothing twice.
 *
 * Two callers, both authorised elsewhere: the owner's report page (their own
 * stalled job, repaired on sight) and the admin console's sweep.
 */

export function stallCutoffIso(now = Date.now()): string {
  const minutes = getEnv().JOB_STALL_MINUTES;
  return new Date(now - minutes * 60_000).toISOString();
}

export function isStalled(job: ResearchJobRecord, now = Date.now()): boolean {
  if (isTerminal(job.status)) return false;
  const pulse = job.heartbeatAt ?? job.createdAt;
  return pulse < stallCutoffIso(now);
}

export interface RepairResult {
  repaired: boolean;
  refundReplayed: boolean;
}

export async function repairStalledJob(job: ResearchJobRecord): Promise<RepairResult> {
  // Re-check at the moment of repair: a job that pulsed since it was listed
  // is alive and keeps running.
  if (!isStalled(job)) return { repaired: false, refundReplayed: false };

  const store = await getResearchJobStore();
  await store.fail(job.id, 'JOB_STALLED');

  let refundReplayed = false;
  try {
    const wallet = await getTokenWallet();
    const refund = await wallet.refund({
      userId: job.userId,
      jobId: job.id,
      idempotencyKey: refundKey(job.id),
      reason: 'Refunded automatically: the research run stopped unexpectedly',
    });
    refundReplayed = refund.replayed;
  } catch (error) {
    // The customer may be owed a credit we could not return — the one failure
    // that needs a human, logged with everything needed to settle it by hand.
    logger.error('job.repair_refund_failed', {
      jobId: job.publicId,
      userId: job.userId,
      tokenCost: job.tokenCost,
      error: String(error),
    });
  }

  logger.info('job.repaired_stalled', {
    jobId: job.publicId,
    attemptCount: job.attemptCount,
    refundReplayed,
  });

  return { repaired: true, refundReplayed };
}

/** The admin sweep: every currently stalled job, repaired. */
export async function repairAllStalled(limit = 20): Promise<{
  examined: number;
  repaired: number;
}> {
  const store = await getResearchJobStore();
  const stalled = await store.listStale(stallCutoffIso(), limit);

  let repaired = 0;
  for (const job of stalled) {
    const result = await repairStalledJob(job);
    if (result.repaired) repaired += 1;
  }
  return { examined: stalled.length, repaired };
}
