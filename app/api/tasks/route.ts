import { requireMember } from '@/lib/auth/membership';
import { getPipelineStore } from '@/lib/pipeline/store';
import { taskSchema } from '@/schemas/pipeline';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** The caller's task queue (GET) and manual task creation (POST). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user } = await requireMember();
    const status =
      new URL(request.url).searchParams.get('status') === 'done' ? 'done' : 'open';
    const store = await getPipelineStore();
    const tasks = await store.tasksForAssignee(user.id, status);
    return jsonResponse({ tasks });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const body = await request.json().catch(() => null);
    const parsed = taskSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Task validation failed');
    }
    const store = await getPipelineStore();
    const { task } = await store.createTask({
      accountId: parsed.data.accountId,
      assigneeId: parsed.data.assigneeId ?? user.id,
      createdBy: user.id,
      title: parsed.data.title,
      detail: parsed.data.detail || null,
      dueOn: parsed.data.dueOn,
    });
    return jsonResponse({ task }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
