import { requireMember, recordAudit } from '@/lib/auth/membership';
import { changeStage } from '@/lib/pipeline/service';
import { getPipelineStore } from '@/lib/pipeline/store';
import { stageChangeSchema } from '@/schemas/pipeline';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** One account's pipeline: move it (POST), read its history (GET). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    await requireMember();
    const { accountId } = await params;
    if (!UUID_SHAPE.test(accountId)) {
      throw new PlatformError('NOT_FOUND', 'No such account');
    }
    const store = await getPipelineStore();
    const history = await store.historyForAccount(accountId);
    return jsonResponse({ history });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const { accountId } = await params;
    if (!UUID_SHAPE.test(accountId)) {
      throw new PlatformError('NOT_FOUND', 'No such account');
    }

    const body = await request.json().catch(() => null);
    const parsed = stageChangeSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Stage change validation failed');
    }

    await changeStage({
      accountId,
      stage: parsed.data.stage,
      note: parsed.data.note,
      changedBy: user.id,
    });
    await recordAudit(user.id, 'pipeline.stage_changed', 'lead_account', accountId, {
      to: parsed.data.stage,
    });
    return jsonResponse({ stage: parsed.data.stage });
  } catch (error) {
    return errorResponse(error);
  }
}
