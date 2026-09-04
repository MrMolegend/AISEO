import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Rule } from '@/components/ui/panel';
import { TerritoryMap } from '@/components/territories/territory-map';
import { territoryRollup } from '@/lib/insights/compute';
import { getLeadStore } from '@/lib/leads/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Territories'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/territories');

  const [config, leads] = await Promise.all([getAltConfigStore(), getLeadStore()]);
  const [territories, accounts] = await Promise.all([
    config.listTerritories(),
    leads.listAccounts({ limit: 1000 }),
  ]);

  const rollups = territoryRollup(
    territories,
    accounts
      .filter((account) => account.status !== 'merged')
      .map((account) => ({
        id: account.id,
        segmentKey: account.segmentKey,
        territoryKey: account.territoryKey,
        pipelineStage: account.pipelineStage,
      })),
  );

  return (
    <WorkspaceShell
      kicker="Territories"
      title="Where the accounts are."
      intro="A schematic view of the GCC lit by real account counts - no mapping provider, no geocoding, and the table below is the exact record."
    >
      <Panel className="mt-10 p-8">
        <TerritoryMap rollups={rollups} />
      </Panel>

      <Rule label="By territory" className="mt-12" />
      <div className="border-rule mt-6 overflow-x-auto border">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-rule text-text-subtle border-b">
              <th className="px-4 py-3 font-medium">Territory</th>
              <th className="px-4 py-3 font-medium">Kind</th>
              <th className="px-4 py-3 font-medium" data-numeric>
                Accounts
              </th>
              <th className="px-4 py-3 font-medium" data-numeric>
                In pipeline
              </th>
              <th className="px-4 py-3 font-medium" data-numeric>
                Won
              </th>
              <th className="px-4 py-3 font-medium">Explore</th>
            </tr>
          </thead>
          <tbody className="divide-rule divide-y">
            {rollups.map((rollup) => (
              <tr key={rollup.key}>
                <td className="text-text px-4 py-3">
                  {rollup.parentKey ? <span className="text-text-subtle">— </span> : null}
                  {rollup.name}
                </td>
                <td className="text-text-muted px-4 py-3">{rollup.kind}</td>
                <td className="text-text px-4 py-3" data-numeric>
                  {rollup.accounts}
                </td>
                <td className="text-text-muted px-4 py-3" data-numeric>
                  {rollup.inPipeline}
                </td>
                <td className="text-text-muted px-4 py-3" data-numeric>
                  {rollup.won}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/leads?territory=${encodeURIComponent(rollup.key)}`}
                    className="text-text-muted underline-offset-2 hover:underline"
                  >
                    View accounts
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WorkspaceShell>
  );
}
