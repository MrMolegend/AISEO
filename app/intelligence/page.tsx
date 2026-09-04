import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import {
  stageFunnel,
  replyRateBy,
  winRateBy,
  MIN_SAMPLE,
  type RateByGroup,
} from '@/lib/insights/compute';
import { getLeadStore } from '@/lib/leads/store';
import { getPipelineStore } from '@/lib/pipeline/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { PIPELINE_STAGE_LABEL } from '@/schemas/pipeline';
import { SEGMENT_LABEL, type SegmentKey } from '@/config/alt';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Intelligence'),
  robots: { index: false, follow: false },
};

function RateTable({
  rows,
  keyLabel,
  labelFor,
}: {
  rows: RateByGroup[];
  keyLabel: string;
  labelFor: (key: string) => string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-text-muted text-[14px] leading-relaxed">
        No outcomes recorded yet for this cut.
      </p>
    );
  }
  return (
    <div className="border-rule overflow-x-auto border">
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="border-rule text-text-subtle border-b">
            <th className="px-4 py-3 font-medium">{keyLabel}</th>
            <th className="px-4 py-3 font-medium">Rate</th>
            <th className="px-4 py-3 font-medium" data-numeric>
              Sample
            </th>
          </tr>
        </thead>
        <tbody className="divide-rule divide-y">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="text-text px-4 py-3">{labelFor(row.key)}</td>
              <td className="px-4 py-3">
                {row.insufficient ? (
                  <span className="text-text-subtle">
                    Not enough data (n = {row.n}, needs {MIN_SAMPLE})
                  </span>
                ) : (
                  <span className="text-text" data-numeric>
                    {row.ratePct}%
                  </span>
                )}
              </td>
              <td className="text-text-muted px-4 py-3" data-numeric>
                {row.numerator} of {row.n}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function Page() {
  await requireWorkspacePage('/intelligence');

  const [leads, pipeline, config] = await Promise.all([
    getLeadStore(),
    getPipelineStore(),
    getAltConfigStore(),
  ]);
  const [rawAccounts, history, territories] = await Promise.all([
    leads.listAccounts({ limit: 1000 }),
    pipeline.allHistory(2000),
    config.listTerritories(),
  ]);

  const accounts = rawAccounts
    .filter((account) => account.status !== 'merged')
    .map((account) => ({
      id: account.id,
      segmentKey: account.segmentKey,
      territoryKey: account.territoryKey,
      pipelineStage: account.pipelineStage,
    }));

  const funnel = stageFunnel(accounts);
  const inPipeline = funnel.reduce((sum, entry) => sum + entry.count, 0);
  const replyBySegment = replyRateBy((account) => account.segmentKey, accounts, history);
  const winByTerritory = winRateBy((account) => account.territoryKey, accounts);
  const territoryName = new Map(
    territories.map((territory) => [territory.key, territory.name]),
  );
  const maxStage = Math.max(1, ...funnel.map((entry) => entry.count));

  return (
    <WorkspaceShell
      kicker="Intelligence"
      title="What the outcomes say."
      intro="Every figure here is computed from recorded results, and every rate carries its sample. Small samples are marked as such rather than charted as truth."
    >
      <Rule label="Pipeline funnel" className="mt-12" />
      {inPipeline === 0 ? (
        <Panel className="mt-6 p-8">
          <p className="text-text-muted text-[14px] leading-relaxed">
            No accounts are in the pipeline yet. The funnel fills as accounts move through
            stages.
          </p>
        </Panel>
      ) : (
        <div className="mt-6 max-w-3xl">
          <ul className="space-y-2">
            {funnel
              .filter((entry) => entry.count > 0)
              .map((entry) => (
                <li key={entry.stage} className="flex items-center gap-4">
                  <span className="text-text-muted w-56 shrink-0 text-[13px]">
                    {PIPELINE_STAGE_LABEL[entry.stage]}
                  </span>
                  <span
                    aria-hidden="true"
                    className="bg-signal/70 h-3"
                    style={{ width: `${Math.max(2, (entry.count / maxStage) * 100)}%` }}
                  />
                  <span className="text-text text-[13px]" data-numeric>
                    {entry.count}
                  </span>
                </li>
              ))}
          </ul>
          <Meta className="mt-3">
            {inPipeline} account{inPipeline === 1 ? '' : 's'} in the pipeline.
          </Meta>
        </div>
      )}

      <Rule label="Contacted to replied, by segment" className="mt-14" />
      <div className="mt-6 max-w-3xl">
        <RateTable
          rows={replyBySegment}
          keyLabel="Segment"
          labelFor={(key) => SEGMENT_LABEL[key as SegmentKey] ?? key}
        />
      </div>

      <Rule label="Win rate among settled accounts, by territory" className="mt-14" />
      <div className="mt-6 max-w-3xl">
        <RateTable
          rows={winByTerritory}
          keyLabel="Territory"
          labelFor={(key) => territoryName.get(key) ?? key}
        />
        <Meta className="mt-3">
          Settled means won, lost or disqualified. Accounts still moving are not counted
          either way.
        </Meta>
      </div>
    </WorkspaceShell>
  );
}
