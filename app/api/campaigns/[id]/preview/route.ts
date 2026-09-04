import { requireMember } from '@/lib/auth/membership';
import { previewCampaign } from '@/lib/discovery/start';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * The cost preview: what this campaign's research would spend, against the
 * caps, before anything spends. The same pure planner the engine uses.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMember();
    const { id } = await params;
    if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such campaign');
    const preview = await previewCampaign(id);
    return jsonResponse({ preview });
  } catch (error) {
    return errorResponse(error);
  }
}
