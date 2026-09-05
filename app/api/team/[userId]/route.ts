import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getTeamStore } from '@/lib/team/store';
import { memberUpdateSchema } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * One membership: role, territories, name, and revocation.
 *
 * super_admin only. Two guard rails beyond the role check:
 *   · nobody edits their own role or revokes themselves — the workspace
 *     cannot be locked out by its last administrator in one misclick;
 *   · the change is audited with before/after values.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { user } = await requireMember('super_admin');
    const { userId } = await params;
    if (!UUID_SHAPE.test(userId)) {
      throw new PlatformError('NOT_FOUND', 'No such member');
    }

    const body = await request.json().catch(() => null);
    const parsed = memberUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Update validation failed', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    if (
      userId === user.id &&
      (parsed.data.role !== undefined || parsed.data.status !== undefined)
    ) {
      throw new PlatformError(
        'INVALID_INPUT',
        'You cannot change your own role or revoke your own access.',
      );
    }

    const store = await getTeamStore();
    const before = await store.get(userId);
    if (!before) throw new PlatformError('NOT_FOUND', 'No such member');

    const member = await store.update(userId, parsed.data);
    if (!member) throw new PlatformError('NOT_FOUND', 'No such member');

    await recordAudit(user.id, 'team.update', 'team_member', userId, {
      before: { role: before.role, status: before.status },
      after: { role: member.role, status: member.status },
    });

    return jsonResponse({ member });
  } catch (error) {
    return errorResponse(error);
  }
}
