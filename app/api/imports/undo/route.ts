import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { undoImport } from '@/lib/imports/service';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Undo an import: the named accounts go to 'rejected' — but only those
 * still untouched candidates. Anything a colleague has qualified or moved
 * through the pipeline is left standing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ accountIds: z.array(z.uuid()).min(1).max(500) });

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) throw new PlatformError('INVALID_INPUT', 'Name the accounts');
    const reverted = await undoImport(parsed.data.accountIds);
    await recordAudit(user.id, 'import.undone', 'import', null, {
      requested: parsed.data.accountIds.length,
      reverted,
    });
    return jsonResponse({ reverted });
  } catch (error) {
    return errorResponse(error);
  }
}
