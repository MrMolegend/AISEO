import { after } from 'next/server';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { startCampaign } from '@/lib/discovery/start';
import { runCampaignDiscovery } from '@/lib/discovery/engine';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';
import { logger } from '@/lib/observability/logger';

/**
 * Start (confirm) a campaign's research.
 *
 * The response returns as soon as the run exists; the pipeline itself runs
 * in `after()`, exactly like the report pipeline. Budget caps are enforced
 * inside startCampaign regardless of what any client displayed, and a
 * resubmission while a run is live joins that run instead of starting a
 * second one — the duplicate guard is a database index.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    const { id } = await params;
    if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such campaign');

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`campaign-start:${user.id}`, 20, 3_600));

    const { run, duplicate } = await startCampaign(id, user.id);

    if (!duplicate) {
      await recordAudit(user.id, 'campaign.started', 'campaign', id, {
        runId: run.id,
        unitsBudget: run.unitsBudget,
      });
      after(async () => {
        try {
          await runCampaignDiscovery(run.id);
        } catch (error) {
          // The engine settles its own failures; reaching here means the
          // settling itself threw, which is the one case needing a human.
          logger.error('discovery.after_hook_failed', {
            runId: run.id,
            error: String(error),
          });
        }
      });
    }

    return jsonResponse({ run, duplicate }, duplicate ? 200 : 202);
  } catch (error) {
    return errorResponse(error);
  }
}
