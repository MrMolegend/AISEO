import { requireMember } from '@/lib/auth/membership';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { watchlistInputSchema } from '@/schemas/signals';
import { getSignalStore } from '@/lib/signals/store';
import { getLeadStore } from '@/lib/leads/store';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/** The caller's watchlists, and creating a new one. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const store = await getSignalStore();
    const watchlists = await store.listWatchlists(user.id);
    return jsonResponse({ watchlists });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_WORK_LEADS);
    const body = await request.json().catch(() => null);
    const parsed = watchlistInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Watch validation failed');
    }
    if (parsed.data.kind === 'account') {
      const leads = await getLeadStore();
      const account = await leads.getAccount(parsed.data.accountId!);
      if (!account || account.status === 'merged') {
        throw new PlatformError('NOT_FOUND', 'No such account');
      }
    }
    const store = await getSignalStore();
    const watchlist = await store.createWatchlist({
      ownerId: user.id,
      name: parsed.data.name,
      kind: parsed.data.kind,
      accountId: parsed.data.kind === 'account' ? parsed.data.accountId : null,
      segmentKey: parsed.data.kind === 'segment' ? parsed.data.segmentKey : null,
      territoryKey: parsed.data.kind === 'segment' ? parsed.data.territoryKey : null,
    });
    return jsonResponse({ watchlist }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
