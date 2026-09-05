import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { IcpForm } from '@/components/icps/icp-form';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';

export const metadata: Metadata = {
  title: pageTitle('New ideal customer profile'),
  robots: { index: false, follow: false },
};

export default async function NewIcpPage() {
  await requireWorkspacePage('/icps/new', ...ROLES_WHO_MANAGE_CAMPAIGNS);
  const config = await getAltConfigStore();
  const territories = await config.listTerritories();

  return (
    <WorkspaceShell
      kicker="New profile"
      title="Describe the customer worth finding."
      intro="Only the name, a territory and a segment are required. Everything else narrows the search; nothing here invents facts about any account."
    >
      <div className="mt-10 max-w-3xl">
        <IcpForm territories={territories} />
      </div>
    </WorkspaceShell>
  );
}
