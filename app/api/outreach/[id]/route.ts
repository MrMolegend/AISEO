import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getOutreachStore } from '@/lib/outreach/store';
import { lintDraftRecord } from '@/lib/outreach/service';
import { editDraftSchema, draftDecisionSchema } from '@/schemas/outreach';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * One draft: read with its versions and current violations; edit the body
 * (a new version, approval reset); approve or reject.
 *
 * Approval is refused while the linter finds unsupported claims, and it
 * requires the explicit reviewed flag — the human act the product is built
 * around. Nothing here sends anything.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function draftFrom(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such draft');
  const store = await getOutreachStore();
  const draft = await store.get(id);
  if (!draft) throw new PlatformError('NOT_FOUND', 'No such draft');
  return { store, draft };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMember();
    const { store, draft } = await draftFrom(params);
    const [versions, violations] = await Promise.all([
      store.versions(draft.id),
      lintDraftRecord(draft),
    ]);
    return jsonResponse({ draft, versions, violations });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const { store, draft } = await draftFrom(params);

    const body = await request.json().catch(() => null);

    const asEdit = editDraftSchema.safeParse(body);
    if (asEdit.success) {
      const updated = await store.updateBody(draft.id, asEdit.data.body, user.id);
      const violations = updated ? await lintDraftRecord(updated) : [];
      return jsonResponse({ draft: updated, violations });
    }

    const asDecision = draftDecisionSchema.safeParse(body);
    if (asDecision.success) {
      if (asDecision.data.decision === 'approve') {
        if (!asDecision.data.reviewed) {
          throw new PlatformError(
            'INVALID_INPUT',
            'Approval requires confirming you have reviewed the draft.',
          );
        }
        const violations = await lintDraftRecord(draft);
        if (violations.length > 0) {
          throw new PlatformError(
            'INVALID_INPUT',
            `The draft cannot be approved while it makes unsupported claims: ${violations[0]!.message}`,
            { context: { violations } },
          );
        }
      }
      const updated = await store.setStatus(
        draft.id,
        asDecision.data.decision === 'approve' ? 'approved' : 'rejected',
        user.id,
      );
      await recordAudit(
        user.id,
        `outreach.${asDecision.data.decision}`,
        'outreach_draft',
        draft.id,
      );
      return jsonResponse({ draft: updated });
    }

    throw new PlatformError('INVALID_INPUT', 'Expected an edit or a decision');
  } catch (error) {
    return errorResponse(error);
  }
}
