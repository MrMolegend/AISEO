import { z } from 'zod';
import { requireMember } from '@/lib/auth/membership';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { getSignalStore } from '@/lib/signals/store';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** Dismissing a signal: read, noted, out of the queue. Nothing is sent. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.uuid() });

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireMember(...ROLES_WHO_WORK_LEADS);
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new PlatformError('NOT_FOUND', 'No such signal');
    const store = await getSignalStore();
    const dismissed = await store.dismissSignal(parsed.data.id);
    if (!dismissed) throw new PlatformError('NOT_FOUND', 'No such signal');
    return jsonResponse({ dismissed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
