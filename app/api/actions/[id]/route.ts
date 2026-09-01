import { requireUser } from '@/lib/auth/server';
import { getActionItemStore } from '@/lib/actions/store';
import { updateActionSchema } from '@/schemas/action-item';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * One action item: edit and delete. Ownership is the store's filter; a
 * foreign or unknown id is the same NOT_FOUND either way.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function actionId(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such action');
  return id;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const parsed = updateActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'The change did not validate', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const store = await getActionItemStore();
    const action = await store.update(await actionId(params), user.id, parsed.data);
    if (!action) throw new PlatformError('NOT_FOUND', 'No such action');
    return jsonResponse({ action });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const store = await getActionItemStore();
    const deleted = await store.delete(await actionId(params), user.id);
    if (!deleted) throw new PlatformError('NOT_FOUND', 'No such action');
    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
