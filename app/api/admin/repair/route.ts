import { requireAdmin } from '@/lib/auth/admin';
import { repairAllStalled } from '@/lib/jobs/recovery';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { logger } from '@/lib/observability/logger';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * The admin stall sweep.
 *
 * Repairs every currently stalled job: fail with the refundable JOB_STALLED
 * code, refund through the ledger's idempotent path. Running it twice —
 * or two admins racing — settles nothing twice; that is the ledger's
 * guarantee, and the reason this button does not need a lock. Every sweep
 * is logged with who pressed it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const admin = await requireAdmin();

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`admin-repair:${admin.id}`, 12, 3_600));

    const result = await repairAllStalled();

    logger.info('admin.stall_sweep', {
      adminId: admin.id,
      examined: result.examined,
      repaired: result.repaired,
    });

    return jsonResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
