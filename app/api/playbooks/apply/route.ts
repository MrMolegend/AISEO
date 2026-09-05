import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { applyPlaybook } from '@/lib/pipeline/service';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Apply a playbook to an account: its steps become tasks with computed
 * due dates. Idempotent — a second application converges on the first.
 * Playbooks schedule work for people; nothing is sent by applying one.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const applySchema = z.object({
  accountId: z.uuid(),
  playbookKey: z.string().trim().min(1).max(60),
});

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const body = await request.json().catch(() => null);
    const parsed = applySchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Playbook validation failed');
    }

    const result = await applyPlaybook({
      accountId: parsed.data.accountId,
      playbookKey: parsed.data.playbookKey,
      assigneeId: user.id,
      createdBy: user.id,
    });
    await recordAudit(
      user.id,
      'playbook.applied',
      'lead_account',
      parsed.data.accountId,
      {
        playbookKey: parsed.data.playbookKey,
        created: result.created.length,
        existing: result.existing,
      },
    );
    return jsonResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
