import { requireUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { importPlanActions } from '@/lib/actions/import';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * "Add this plan to my workspace."
 *
 * POST imports the report's recommended actions, exactly once however many
 * times it is pressed — the store's unique index makes a retry converge on
 * the rows that already exist. The job read is owner-filtered, so importing
 * from someone else's report is a NOT_FOUND before anything is written.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`action-import:${user.id}`, 30, 3_600));

    const store = await getResearchJobStore();
    const job = await store.getForUser(publicId, user.id);
    if (!job || job.status !== 'complete' || job.packageId !== 'market-entry') {
      throw new PlatformError('NOT_FOUND', 'No such report');
    }

    const result = await importPlanActions(user.id, job);
    return jsonResponse({ imported: result.imported.length, total: result.total });
  } catch (error) {
    return errorResponse(error);
  }
}
