import { z } from 'zod';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getOutreachStore } from '@/lib/outreach/store';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * The do-not-contact list. Managers write it; every member's generation
 * path reads it. Entries block draft generation absolutely, across every
 * campaign — that is what suppression means.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const entrySchema = z.object({
  kind: z.enum(['account', 'contact', 'channel_value']),
  value: z.string().trim().min(1).max(300),
  reason: z.string().trim().max(500).default(''),
});

export async function GET() {
  try {
    await requireMember('super_admin', 'sales_manager');
    const store = await getOutreachStore();
    return jsonResponse({ entries: await store.listSuppression() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember('super_admin', 'sales_manager');
    const body = await request.json().catch(() => null);
    const parsed = entrySchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Suppression validation failed');
    }
    const store = await getOutreachStore();
    const entry = await store.addSuppression({ ...parsed.data, createdBy: user.id });
    await recordAudit(user.id, 'suppression.added', 'suppression_entry', entry.id, {
      kind: entry.kind,
    });
    return jsonResponse({ entry }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { user } = await requireMember('super_admin', 'sales_manager');
    const id = new URL(request.url).searchParams.get('id');
    if (!id) throw new PlatformError('INVALID_INPUT', 'Missing entry id');
    const store = await getOutreachStore();
    const removed = await store.removeSuppression(id);
    if (!removed) throw new PlatformError('NOT_FOUND', 'No such entry');
    await recordAudit(user.id, 'suppression.removed', 'suppression_entry', id);
    return jsonResponse({ removed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
