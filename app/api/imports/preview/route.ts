import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { buildPreview } from '@/lib/imports/service';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** Dry run: what this CSV would do, row by row. Nothing is written. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({ text: z.string().max(2_000_000) });

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);
    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) throw new PlatformError('INVALID_INPUT', 'Paste CSV text');
    const preview = await buildPreview(parsed.data.text);
    await recordAudit(user.id, 'import.previewed', 'import', null, {
      rows: preview.rows.length,
      creatable: preview.creatable,
      errors: preview.errors,
    });
    return jsonResponse({ preview });
  } catch (error) {
    return errorResponse(error);
  }
}
