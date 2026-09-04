import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Meta } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getLeadStore } from '@/lib/leads/store';
import { getCampaignStore } from '@/lib/campaigns/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { SEGMENT_LABEL, type SegmentKey } from '@/config/alt';
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from '@/schemas/campaign';

export const metadata: Metadata = {
  title: pageTitle('Lead explorer'),
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 50;

/**
 * The lead explorer.
 *
 * Server-rendered with GET-form filters: the URL is the filter state, so
 * every view is shareable, the back button works, and no lead table ever
 * hydrates thousands of rows — pagination happens in the store.
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    campaign?: string;
    territory?: string;
    page?: string;
  }>;
}) {
  await requireWorkspacePage('/leads');
  const params = await searchParams;

  const status =
    params.status && (LEAD_STATUSES as readonly string[]).includes(params.status)
      ? (params.status as LeadStatus)
      : undefined;
  const page = Math.max(1, Number(params.page ?? '1') || 1);

  const store = await getLeadStore();
  const campaigns = await getCampaignStore();
  const config = await getAltConfigStore();

  const filters = {
    statuses: status ? [status] : undefined,
    campaignId: params.campaign,
    territoryKey: params.territory,
    search: params.q?.slice(0, 120),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };

  const [accounts, total, campaignList, territories] = await Promise.all([
    store.listAccounts(filters),
    store.countAccounts(filters),
    campaigns.list(),
    config.listTerritories(),
  ]);
  const territoryName = new Map(territories.map((t) => [t.key, t.name]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const queryFor = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set('q', params.q);
    if (status) search.set('status', status);
    if (params.campaign) search.set('campaign', params.campaign);
    if (params.territory) search.set('territory', params.territory);
    if (nextPage > 1) search.set('page', String(nextPage));
    const qs = search.toString();
    return qs ? `/leads?${qs}` : '/leads';
  };

  return (
    <WorkspaceShell
      kicker="Lead explorer"
      title="Every account, one working surface."
      intro="Search, filter and work the accounts discovery has found, with evidence and freshness beside every claim. Merged duplicates are hidden; nothing here is ever invented."
    >
      <form method="get" className="mt-8 flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label htmlFor="q" className="text-text mb-2 block text-[13px] font-medium">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ''}
            placeholder="Account name"
            className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
          />
        </div>
        <div>
          <label
            htmlFor="status"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ''}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[14px]"
          >
            <option value="">All working statuses</option>
            {LEAD_STATUSES.filter((value) => value !== 'merged').map((value) => (
              <option key={value} value={value}>
                {LEAD_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="campaign"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Campaign
          </label>
          <select
            id="campaign"
            name="campaign"
            defaultValue={params.campaign ?? ''}
            className="border-rule-strong bg-ground-raised text-text max-w-56 border px-3 py-2.5 text-[14px]"
          >
            <option value="">All campaigns</option>
            {campaignList.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="territory"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Territory
          </label>
          <select
            id="territory"
            name="territory"
            defaultValue={params.territory ?? ''}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[14px]"
          >
            <option value="">All territories</option>
            {territories.map((territory) => (
              <option key={territory.key} value={territory.key}>
                {territory.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <Meta data-numeric role="status">
          {total} account{total === 1 ? '' : 's'}
        </Meta>
        {totalPages > 1 && (
          <Meta data-numeric>
            Page {page} of {totalPages}
          </Meta>
        )}
      </div>

      {accounts.length === 0 ? (
        <Panel className="mt-4 p-8 text-center">
          <p className="text-text font-medium">Nothing matches.</p>
          <p className="text-text-muted mx-auto mt-2 max-w-md text-[14px] leading-relaxed">
            {total === 0 && !params.q && !status
              ? 'No accounts yet. Run a discovery campaign and qualified candidates land here with their sources attached.'
              : 'Loosen the filters, or check another campaign.'}
          </p>
        </Panel>
      ) : (
        <div
          className="border-rule mt-4 overflow-x-auto border"
          role="region"
          aria-label="Accounts"
          tabIndex={0}
        >
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-rule text-text-subtle border-b text-[12px] tracking-wide uppercase">
                <th scope="col" className="px-4 py-3 font-medium">
                  Account
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Segment
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Territory
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Website
                </th>
              </tr>
            </thead>
            <tbody className="divide-rule divide-y">
              {accounts.map((account) => (
                <tr key={account.id} className="text-[14px]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/leads/${account.id}`}
                      className="text-text font-medium hover:underline"
                    >
                      {account.canonicalName}
                    </Link>
                  </td>
                  <td className="text-text-muted px-4 py-3">
                    {account.segmentKey
                      ? (SEGMENT_LABEL[account.segmentKey as SegmentKey] ??
                        account.segmentKey)
                      : '—'}
                  </td>
                  <td className="text-text-muted px-4 py-3">
                    {account.territoryKey
                      ? (territoryName.get(account.territoryKey) ?? account.territoryKey)
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={account.status} />
                  </td>
                  <td className="text-text-muted px-4 py-3">
                    {account.websiteUrl ? 'Yes' : 'None found'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center gap-3">
          {page > 1 && (
            <Button asChild variant="secondary" size="sm">
              <Link href={queryFor(page - 1)}>Previous</Link>
            </Button>
          )}
          {page < totalPages && (
            <Button asChild variant="secondary" size="sm">
              <Link href={queryFor(page + 1)}>Next</Link>
            </Button>
          )}
        </nav>
      )}
    </WorkspaceShell>
  );
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const tone =
    status === 'qualified'
      ? 'text-signal'
      : status === 'rejected'
        ? 'text-copper'
        : 'text-text-muted';
  return (
    <span className={`${tone} text-[12px] font-medium tracking-wide uppercase`}>
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}
