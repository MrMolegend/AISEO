import { requireAdmin } from '@/lib/auth/admin';
import { recordAudit } from '@/lib/auth/membership';
import { repairStalledCampaignRuns } from '@/lib/discovery/start';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { logger } from '@/lib/observability/logger';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * The campaign-run stall sweep: fail every run whose heartbeat has gone
 * quiet, so its campaign can be restarted deliberately. Idempotent — the
 * sweep re-reads each run and skips anything already settled — and every
 * press is audited with who pressed it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const admin = await requireAdmin();

    const limiter = await getRateLimiter();
    assertWithinLimit(
      await limiter.checkWindow(`admin-repair-campaigns:${admin.id}`, 12, 3_600),
    );

    const examined = await repairStalledCampaignRuns();
    await recordAudit(admin.id, 'campaign_runs.repaired', 'campaign_run', null, {
      examined,
    });
    logger.info('admin.campaign_repair', { adminId: admin.id, examined });
    return jsonResponse({ examined });
  } catch (error) {
    return errorResponse(error);
  }
}
