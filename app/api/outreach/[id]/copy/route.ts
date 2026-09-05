import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getOutreachStore } from '@/lib/outreach/store';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Taking an approved draft out of the product.
 *
 * The body is only released for an APPROVED draft, and the act is recorded
 * — channel, who, when — because copying is the moment a proposal becomes
 * a message a person will send with their own hands.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const { id } = await params;
    if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such draft');

    const store = await getOutreachStore();
    const draft = await store.get(id);
    if (!draft) throw new PlatformError('NOT_FOUND', 'No such draft');
    if (draft.status !== 'approved') {
      throw new PlatformError(
        'INVALID_INPUT',
        'Only an approved draft can be copied. Review and approve it first.',
      );
    }

    await store.recordCopy(id);
    await recordAudit(user.id, 'outreach.copied', 'outreach_draft', id, {
      channel: draft.channel,
    });
    return jsonResponse({ body: draft.body });
  } catch (error) {
    return errorResponse(error);
  }
}
