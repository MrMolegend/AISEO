import { requireMember, recordAudit } from '@/lib/auth/membership';
import { ROLES_WHO_EXPORT } from '@/schemas/team';
import { getLeadStore, type AccountFilters } from '@/lib/leads/store';
import { toCsv, csvFilename, contentDispositionFor } from '@/lib/export/csv';
import { LEAD_STATUSES, type LeadStatus } from '@/schemas/campaign';
import { errorResponse } from '@/lib/api/respond';

/**
 * The lead export.
 *
 * Export is a role, not a convenience: only super_admin and sales_manager
 * hold it, and every export is audited with its filters and row count.
 * Cells pass through the shared CSV layer, whose formula-injection
 * neutralisation exists precisely because these values are text taken
 * from third-party web pages. Identifiers and provenance only — no
 * evidence bodies, no draft contents, and never a secret.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_EXPORT);

    const params = new URL(request.url).searchParams;
    const status = params.get('status');
    const filters: AccountFilters = {
      segmentKey: params.get('segment') ?? undefined,
      territoryKey: params.get('territory') ?? undefined,
      search: params.get('q') ?? undefined,
      statuses:
        status && (LEAD_STATUSES as readonly string[]).includes(status)
          ? [status as LeadStatus]
          : undefined,
      limit: 1000,
    };

    const store = await getLeadStore();
    const accounts = (await store.listAccounts(filters)).filter(
      (account) => account.status !== 'merged',
    );

    const csv = toCsv(accounts, [
      { header: 'name', value: (account) => account.canonicalName },
      { header: 'status', value: (account) => account.status },
      { header: 'segment', value: (account) => account.segmentKey },
      { header: 'territory', value: (account) => account.territoryKey },
      { header: 'website', value: (account) => account.websiteUrl },
      { header: 'pipeline_stage', value: (account) => account.pipelineStage },
      { header: 'created_at', value: (account) => account.createdAt },
    ]);

    await recordAudit(user.id, 'leads.exported', 'export', null, {
      rows: accounts.length,
      segment: filters.segmentKey ?? null,
      territory: filters.territoryKey ?? null,
      status: status ?? null,
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDispositionFor(
          csvFilename('alt-signal', 'leads', new Date().toISOString()),
        ),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
