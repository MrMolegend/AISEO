import { z } from 'zod';
import { requireMember } from '@/lib/auth/membership';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { getSignalStore } from '@/lib/signals/store';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** One watch: its signals, and removing it. Ownership is checked in-query. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new PlatformError('NOT_FOUND', 'No such watch');
    const store = await getSignalStore();
    const watchlist = await store.getWatchlist(parsed.data.id);
    if (!watchlist || watchlist.ownerId !== user.id) {
      throw new PlatformError('NOT_FOUND', 'No such watch');
    }
    const signals = await store.listSignals(watchlist.id);
    return jsonResponse({ watchlist, signals });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new PlatformError('NOT_FOUND', 'No such watch');
    const store = await getSignalStore();
    const removed = await store.deleteWatchlist(parsed.data.id, user.id);
    if (!removed) throw new PlatformError('NOT_FOUND', 'No such watch');
    return jsonResponse({ removed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
