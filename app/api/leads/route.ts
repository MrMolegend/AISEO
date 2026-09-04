import { requireMember } from '@/lib/auth/membership';
import { getLeadStore } from '@/lib/leads/store';
import { LEAD_STATUSES, type LeadStatus } from '@/schemas/campaign';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * The lead list, filterable and paginated.
 *
 * Every member can read the workspace's accounts — this is an internal
 * sales tool, and a rep can see the landscape — while writes go through
 * the per-account route with its own role checks.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireMember();
    const url = new URL(request.url);

    const statusParam = url.searchParams.get('status');
    const statuses =
      statusParam && (LEAD_STATUSES as readonly string[]).includes(statusParam)
        ? [statusParam as LeadStatus]
        : undefined;
    const campaignId = url.searchParams.get('campaign') ?? undefined;
    const territoryKey = url.searchParams.get('territory') ?? undefined;
    const segmentKey = url.searchParams.get('segment') ?? undefined;
    const search = url.searchParams.get('q')?.slice(0, 120) ?? undefined;
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
    const pageSize = 50;

    const store = await getLeadStore();
    const filters = {
      statuses,
      campaignId,
      territoryKey,
      segmentKey,
      search,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    const [accounts, total] = await Promise.all([
      store.listAccounts(filters),
      store.countAccounts(filters),
    ]);

    return jsonResponse({ accounts, total, page, pageSize });
  } catch (error) {
    return errorResponse(error);
  }
}
