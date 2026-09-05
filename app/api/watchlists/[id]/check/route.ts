import { z } from 'zod';
import { requireMember } from '@/lib/auth/membership';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { checkWatchlist } from '@/lib/signals/check';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Run one bounded check now. The service enforces both caps — per-watch
 * per-day, and the shared workspace daily research budget.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.uuid() });

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) throw new PlatformError('NOT_FOUND', 'No such watch');
    const outcome = await checkWatchlist(parsed.data.id, user.id);
    return jsonResponse({ outcome });
  } catch (error) {
    return errorResponse(error);
  }
}
