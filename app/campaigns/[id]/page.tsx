import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Meta } from '@/components/ui/panel';
import { RunConsole } from '@/components/campaigns/run-console';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getCampaignStore } from '@/lib/campaigns/store';
import { getIcpStore } from '@/lib/icps/store';
import { previewCampaign } from '@/lib/discovery/start';
import { CAMPAIGN_STATUS_LABEL } from '@/schemas/campaign';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';

export const metadata: Metadata = {
  title: pageTitle('Campaign'),
  robots: { index: false, follow: false },
};

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireWorkspacePage(`/campaigns/${id}`);
  if (!UUID_SHAPE.test(id)) notFound();

  const store = await getCampaignStore();
  const campaign = await store.get(id);
  if (!campaign) notFound();

  const icps = await getIcpStore();
  const icp = campaign.icpId ? await icps.get(campaign.icpId) : null;
  const run = await store.latestRun(id);
  const canManage = (ROLES_WHO_MANAGE_CAMPAIGNS as readonly string[]).includes(
    membership.member.role,
  );

  const preview =
    canManage && !['archived'].includes(campaign.status)
      ? await previewCampaign(id).catch(() => null)
      : null;

  return (
    <WorkspaceShell
      kicker={`Campaign — ${CAMPAIGN_STATUS_LABEL[campaign.status]}`}
      title={campaign.name}
      intro={campaign.objective || undefined}
    >
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
        <Meta>Profile: {icp?.name ?? 'removed'}</Meta>
        <Meta>Territories: {campaign.territoryKeys.join(', ')}</Meta>
        <Meta data-numeric>
          Up to {campaign.maxAccounts} accounts · {campaign.maxContactsPerAccount}{' '}
          contacts each
        </Meta>
      </div>

      <RunConsole
        campaignId={campaign.id}
        campaignStatus={campaign.status}
        canManage={canManage}
        preview={preview}
        initialRun={
          run
            ? {
                id: run.id,
                status: run.status,
                stage: run.stage,
                errorCode: run.errorCode,
                unitsBudget: run.unitsBudget,
                unitsSpent: run.unitsSpent,
                accountsFound: run.accountsFound,
                accountsQualified: run.accountsQualified,
                contactsFound: run.contactsFound,
              }
            : null
        }
      />
    </WorkspaceShell>
  );
}
