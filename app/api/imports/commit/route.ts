import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { commitImport } from '@/lib/imports/service';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Commit the pasted CSV. The server re-runs the same preview computation
 * and imports only what the preview would have shown; creation is
 * dedup-aware, so committing the same file twice converges.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ text: z.string().max(2_000_000) });

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) throw new PlatformError('INVALID_INPUT', 'Paste CSV text');
    const result = await commitImport(parsed.data.text);
    await recordAudit(user.id, 'import.committed', 'import', null, {
      created: result.created,
      existed: result.existed,
      skipped: result.skipped,
    });
    return jsonResponse({ result }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
