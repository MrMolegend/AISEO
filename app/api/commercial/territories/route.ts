import { requireMember } from '@/lib/auth/membership';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** Active territories, for pickers. Editing territories is a migration-time
 * or admin-SQL concern for now; the ICP and campaign layers only read. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireMember();
    const store = await getAltConfigStore();
    const territories = await store.listTerritories();
    return jsonResponse({ territories });
  } catch (error) {
    return errorResponse(error);
  }
}
