import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { recomputeAccountScore } from '@/lib/scoring/service';
import { getScoreStore } from '@/lib/scoring/store';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * One account's score: recompute (POST) and override (PATCH).
 *
 * Overrides are for managers, demand a written reason, and never destroy
 * the computed value — the decomposition keeps showing what the arithmetic
 * said next to what the human decided.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function idFrom(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such account');
  return id;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const id = await idFrom(params);
    const { score, matches } = await recomputeAccountScore(id);
    await recordAudit(user.id, 'score.recomputed', 'lead_account', id, {
      total: score.total,
    });
    return jsonResponse({ score, matches });
  } catch (error) {
    return errorResponse(error);
  }
}

const overrideSchema = z.union([
  z.object({
    overrideTotal: z.number().int().min(0).max(100),
    reason: z.string().trim().min(1, { error: 'An override needs its reason.' }).max(500),
  }),
  z.object({ clearOverride: z.literal(true) }),
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember('super_admin', 'sales_manager');
    const id = await idFrom(params);

    const body = await request.json().catch(() => null);
    const parsed = overrideSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Override validation failed');
    }

    const store = await getScoreStore();
    const score = await store.setOverride(
      id,
      'clearOverride' in parsed.data
        ? null
        : { total: parsed.data.overrideTotal, reason: parsed.data.reason, by: user.id },
    );
    if (!score) throw new PlatformError('NOT_FOUND', 'No score to override yet');

    await recordAudit(user.id, 'score.override', 'lead_account', id, {
      overrideTotal: score.overrideTotal,
      computedTotal: score.total,
    });
    return jsonResponse({ score });
  } catch (error) {
    return errorResponse(error);
  }
}
