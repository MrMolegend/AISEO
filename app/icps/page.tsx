import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Meta } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getIcpStore } from '@/lib/icps/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { SEGMENT_LABEL, type SegmentKey } from '@/config/alt';
import { EVIDENCE_LEVEL_LABEL } from '@/schemas/icp';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';

export const metadata: Metadata = {
  title: pageTitle('Ideal customer profiles'),
  robots: { index: false, follow: false },
};

/**
 * The ICP library.
 *
 * Workspace-shared reference material: every campaign starts from one of
 * these. Viewers and reps can read them; the campaign-managing roles get
 * the editing affordances.
 */
export default async function IcpsPage() {
  const membership = await requireWorkspacePage('/icps');
  const canEdit = (ROLES_WHO_MANAGE_CAMPAIGNS as readonly string[]).includes(
    membership.member.role,
  );

  const store = await getIcpStore();
  const config = await getAltConfigStore();
  const [icps, territories] = await Promise.all([store.list(), config.listTerritories()]);
  const territoryName = new Map(territories.map((t) => [t.key, t.name]));

  return (
    <WorkspaceShell
      kicker="Ideal customer profiles"
      title="The accounts worth finding, described once."
      intro="Territory, segment, category mix, evidence bar and budget caps — reusable across campaigns. Empty criteria constrain nothing; discovery inherits every constraint you do set."
      actions={
        canEdit ? (
          <Button asChild>
            <Link href="/icps/new">New profile</Link>
          </Button>
        ) : undefined
      }
    >
      {icps.length === 0 ? (
        <Panel className="mt-10 p-8 text-center">
          <p className="text-text font-medium">No profiles yet.</p>
          <p className="text-text-muted mx-auto mt-2 max-w-md text-[14px] leading-relaxed">
            The first campaign starts here: describe the customer worth finding and
            discovery inherits every constraint.
          </p>
          {canEdit && (
            <div className="mt-6">
              <Button asChild>
                <Link href="/icps/new">Create the first profile</Link>
              </Button>
            </div>
          )}
        </Panel>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {icps.map((icp) => (
            <li key={icp.id}>
              <Panel className="flex h-full flex-col p-6">
                <Meta>{EVIDENCE_LEVEL_LABEL[icp.minEvidenceLevel].split(' — ')[0]}</Meta>
                <h2 className="font-display text-text mt-2 text-xl font-medium">
                  {canEdit ? (
                    <Link href={`/icps/${icp.id}`} className="hover:underline">
                      {icp.name}
                    </Link>
                  ) : (
                    icp.name
                  )}
                </h2>
                <p className="text-text-muted mt-2 text-[13px] leading-relaxed">
                  {icp.territoryKeys
                    .map((key) => territoryName.get(key) ?? key)
                    .join(', ')}
                </p>
                <p className="text-text-subtle mt-1 flex-1 text-[13px] leading-relaxed">
                  {icp.segmentKeys
                    .map((key) => SEGMENT_LABEL[key as SegmentKey] ?? key)
                    .join(' · ')}
                </p>
                <p className="text-text-subtle mt-3 text-[12px]" data-numeric>
                  Up to {icp.maxAccounts} accounts · {icp.maxContactsPerAccount} contacts
                  each · {icp.researchBudgetUnits} research units
                </p>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </WorkspaceShell>
  );
}
