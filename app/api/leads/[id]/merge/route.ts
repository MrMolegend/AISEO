import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getLeadStore } from '@/lib/leads/store';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Manual merge and its undo.
 *
 * A merge is a person's judgement, recorded with a reason and reversible:
 * the loser is marked merged-into rather than destroyed, and undo restores
 * it exactly. Managers and analysts only — a mistaken merge misleads
 * everyone downstream.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mergeSchema = z.object({
  action: z.literal('merge'),
  loserId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(1, { error: 'Say why these are the same business.' })
    .max(500),
});

const undoSchema = z.object({
  action: z.literal('undo'),
  mergeId: z.uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember('super_admin', 'sales_manager', 'analyst');
    const { id } = await params;
    if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such account');

    const body = await request.json().catch(() => null);
    const store = await getLeadStore();

    const asMerge = mergeSchema.safeParse(body);
    if (asMerge.success) {
      if (asMerge.data.loserId === id) {
        throw new PlatformError('INVALID_INPUT', 'An account cannot merge into itself.');
      }
      const merge = await store.merge(
        id,
        asMerge.data.loserId,
        user.id,
        asMerge.data.reason,
      );
      await recordAudit(user.id, 'lead.merged', 'lead_account', id, {
        loserId: asMerge.data.loserId,
        reason: asMerge.data.reason,
      });
      return jsonResponse({ merge }, 201);
    }

    const asUndo = undoSchema.safeParse(body);
    if (asUndo.success) {
      const undone = await store.undoMerge(asUndo.data.mergeId);
      if (!undone) throw new PlatformError('NOT_FOUND', 'No such merge to undo');
      await recordAudit(user.id, 'lead.merge_undone', 'lead_account', id, {
        mergeId: asUndo.data.mergeId,
      });
      return jsonResponse({ undone: true });
    }

    throw new PlatformError('INVALID_INPUT', 'Expected a merge or an undo');
  } catch (error) {
    return errorResponse(error);
  }
}
