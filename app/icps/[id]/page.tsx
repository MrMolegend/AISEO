import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { IcpForm } from '@/components/icps/icp-form';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getIcpStore } from '@/lib/icps/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';

export const metadata: Metadata = {
  title: pageTitle('Edit ideal customer profile'),
  robots: { index: false, follow: false },
};

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditIcpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireWorkspacePage(`/icps/${id}`, ...ROLES_WHO_MANAGE_CAMPAIGNS);
  if (!UUID_SHAPE.test(id)) notFound();

  const store = await getIcpStore();
  const icp = await store.get(id);
  if (!icp) notFound();

  const config = await getAltConfigStore();
  const territories = await config.listTerritories();

  return (
    <WorkspaceShell kicker="Edit profile" title={icp.name}>
      <div className="mt-10 max-w-3xl">
        <IcpForm
          icpId={icp.id}
          territories={territories}
          initialValues={{
            name: icp.name,
            territoryKeys: icp.territoryKeys,
            segmentKeys: icp.segmentKeys,
            minEvidenceLevel: icp.minEvidenceLevel,
            maxAccounts: icp.maxAccounts,
            maxContactsPerAccount: icp.maxContactsPerAccount,
            researchBudgetUnits: icp.researchBudgetUnits,
            criteria: icp.criteria,
          }}
        />
      </div>
    </WorkspaceShell>
  );
}
