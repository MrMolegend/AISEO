import { requireUser } from '@/lib/auth/server';
import { getShareLinkStore } from '@/lib/share/store';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Revoking one share link. Revocation is the owner's one-way door: the row
 * stays as audit, and the token it hashed opens nothing from that moment.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such link');

    const revoked = await (await getShareLinkStore()).revoke(id, user.id);
    if (!revoked) throw new PlatformError('NOT_FOUND', 'No such link');
    return jsonResponse({ revoked: true });
  } catch (error) {
    return errorResponse(error);
  }
}
