import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Meta } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getCampaignStore } from '@/lib/campaigns/store';
import { getIcpStore } from '@/lib/icps/store';
import { CAMPAIGN_STATUS_LABEL } from '@/schemas/campaign';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';

export const metadata: Metadata = {
  title: pageTitle('Campaigns'),
  robots: { index: false, follow: false },
};

/** The campaign list: status, scope, and the door to each run. */
export default async function CampaignsPage() {
  const membership = await requireWorkspacePage('/campaigns');
  const canManage = (ROLES_WHO_MANAGE_CAMPAIGNS as readonly string[]).includes(
    membership.member.role,
  );

  const store = await getCampaignStore();
  const icps = await getIcpStore();
  const [campaigns, profiles] = await Promise.all([
    store.list(),
    icps.list({ includeArchived: true }),
  ]);
  const profileName = new Map(profiles.map((icp) => [icp.id, icp.name]));

  return (
    <WorkspaceShell
      kicker="Campaigns"
      title="Bounded research, deliberately started."
      intro="A campaign pairs an ideal customer profile with a territory and a product objective, previews its research cost, and runs within hard caps. Nothing spends before a person confirms the preview."
      actions={
        canManage ? (
          <Button asChild>
            <Link href="/campaigns/new">New campaign</Link>
          </Button>
        ) : undefined
      }
    >
      {campaigns.length === 0 ? (
        <Panel className="mt-10 p-8 text-center">
          <p className="text-text font-medium">No campaigns yet.</p>
          <p className="text-text-muted mx-auto mt-2 max-w-md text-[14px] leading-relaxed">
            Define an ideal customer profile first, then build a campaign from it.
            Discovery inherits every constraint the profile sets.
          </p>
          {canManage && (
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild variant="secondary">
                <Link href="/icps">Ideal customer profiles</Link>
              </Button>
              <Button asChild>
                <Link href="/campaigns/new">New campaign</Link>
              </Button>
            </div>
          )}
        </Panel>
      ) : (
        <ul className="mt-10 space-y-4">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Panel className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-text text-lg font-medium">
                    <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                      {campaign.name}
                    </Link>
                  </h2>
                  <p className="text-text-subtle mt-1 text-[13px]">
                    {profileName.get(campaign.icpId) ?? 'Profile removed'} ·{' '}
                    {campaign.territoryKeys.join(', ')}
                  </p>
                </div>
                <Meta data-numeric>{campaign.budgetUnits} units budget</Meta>
                <span className="text-text-muted text-[13px]">
                  {CAMPAIGN_STATUS_LABEL[campaign.status]}
                </span>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </WorkspaceShell>
  );
}
