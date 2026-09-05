import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { CampaignForm } from '@/components/campaigns/campaign-form';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getIcpStore } from '@/lib/icps/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';

export const metadata: Metadata = {
  title: pageTitle('New campaign'),
  robots: { index: false, follow: false },
};

export default async function NewCampaignPage() {
  await requireWorkspacePage('/campaigns/new', ...ROLES_WHO_MANAGE_CAMPAIGNS);

  const icps = await getIcpStore();
  const config = await getAltConfigStore();
  const [profiles, territories] = await Promise.all([
    icps.list(),
    config.listTerritories(),
  ]);

  return (
    <WorkspaceShell
      kicker="New campaign"
      title="Choose the profile, name the objective."
      intro="The campaign narrows its profile — territories and caps can only tighten. The cost preview and confirmation come after creation, on the campaign page."
    >
      {profiles.length === 0 ? (
        <Panel className="mt-10 p-8 text-center">
          <p className="text-text font-medium">No ideal customer profiles yet.</p>
          <p className="text-text-muted mx-auto mt-2 max-w-md text-[14px]">
            A campaign starts from a profile. Create one first.
          </p>
          <div className="mt-6">
            <Button asChild>
              <Link href="/icps/new">Create a profile</Link>
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="mt-10 max-w-3xl">
          <CampaignForm
            icps={profiles.map((icp) => ({
              id: icp.id,
              name: icp.name,
              territoryKeys: icp.territoryKeys,
              maxAccounts: icp.maxAccounts,
              maxContactsPerAccount: icp.maxContactsPerAccount,
              researchBudgetUnits: icp.researchBudgetUnits,
            }))}
            territoryNames={Object.fromEntries(
              territories.map((territory) => [territory.key, territory.name]),
            )}
          />
        </div>
      )}
    </WorkspaceShell>
  );
}
