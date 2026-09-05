import { z } from 'zod';
import { requireMember } from '@/lib/auth/membership';
import { getPipelineStore } from '@/lib/pipeline/store';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** Complete, reopen or drop one task. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const patchSchema = z.object({ status: z.enum(['open', 'done', 'dropped']) });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireMember(...ROLES_WHO_WORK_LEADS);
    const { id } = await params;
    if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such task');

    const body = await request.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Expected { status }');
    }

    const store = await getPipelineStore();
    const task = await store.updateTaskStatus(id, parsed.data.status);
    if (!task) throw new PlatformError('NOT_FOUND', 'No such task');
    return jsonResponse({ task });
  } catch (error) {
    return errorResponse(error);
  }
}
