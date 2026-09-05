import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getConnectionStore } from '@/lib/linkedin/connections';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * Removes the member's LinkedIn identity link. The stored identity row is
 * deleted entirely — there are no tokens to revoke because none were kept.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { user } = await requireMember();
    const store = await getConnectionStore();
    const removed = await store.deleteLinkedIn(user.id);
    if (removed) {
      await recordAudit(user.id, 'linkedin.disconnected', 'provider_connection', user.id);
    }
    return jsonResponse({ removed });
  } catch (error) {
    return errorResponse(error);
  }
}
