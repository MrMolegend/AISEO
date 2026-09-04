import { requireMember } from '@/lib/auth/membership';
import { getPipelineStore } from '@/lib/pipeline/store';
import { activitySchema } from '@/schemas/pipeline';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** Record what happened: a note, a call, a meeting. Append-only. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const body = await request.json().catch(() => null);
    const parsed = activitySchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Activity validation failed');
    }
    const store = await getPipelineStore();
    const activity = await store.addActivity({
      accountId: parsed.data.accountId,
      contactId: parsed.data.contactId,
      authorId: user.id,
      kind: parsed.data.kind,
      body: parsed.data.body,
      private: parsed.data.private,
    });
    return jsonResponse({ activity }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
