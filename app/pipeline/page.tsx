import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Meta } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getLeadStore } from '@/lib/leads/store';
import { getTeamStore } from '@/lib/team/store';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABEL,
  type PipelineStage,
} from '@/schemas/pipeline';

export const metadata: Metadata = {
  title: pageTitle('Pipeline'),
  robots: { index: false, follow: false },
};

/**
 * The pipeline, grouped by stage in order.
 *
 * A list view rather than draggable cards: stage changes happen on the
 * account page with a note, because "why did this move" is data the board
 * metaphor throws away. Overdue is words, not colour alone.
 */
export default async function PipelinePage() {
  await requireWorkspacePage('/pipeline');

  const leads = await getLeadStore();
  const team = await getTeamStore();
  const [accounts, members] = await Promise.all([
    leads.listAccounts({ limit: 100 }),
    team.list(),
  ]);
  const memberName = new Map(
    members.map((member) => [member.userId, member.displayName]),
  );

  const inPipeline = accounts.filter((account) => account.pipelineStage);
  const byStage = new Map<PipelineStage, typeof inPipeline>();
  for (const account of inPipeline) {
    const stage = account.pipelineStage as PipelineStage;
    byStage.set(stage, [...(byStage.get(stage) ?? []), account]);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <WorkspaceShell
      kicker="Pipeline"
      title="From discovered to won, visibly."
      intro="Stages, owners, next actions and outcomes for every account being worked. Moves are made on the account page, with a note — stage history is kept, and reopening a settled account demands its reason."
    >
      {inPipeline.length === 0 ? (
        <Panel className="mt-10 p-8 text-center">
          <p className="text-text font-medium">Nothing in the pipeline yet.</p>
          <p className="text-text-muted mx-auto mt-2 max-w-md text-[14px] leading-relaxed">
            Qualify accounts in the lead explorer, then move them into a stage from their
            account page.
          </p>
        </Panel>
      ) : (
        <div className="mt-10 space-y-10">
          {PIPELINE_STAGES.filter((stage) => byStage.has(stage)).map((stage) => (
            <section key={stage} aria-labelledby={`stage-${stage}`}>
              <div className="flex items-baseline justify-between">
                <h2 id={`stage-${stage}`} className="text-text text-[15px] font-medium">
                  {PIPELINE_STAGE_LABEL[stage]}
                </h2>
                <Meta data-numeric>{byStage.get(stage)!.length}</Meta>
              </div>
              <ul className="border-rule divide-rule mt-3 divide-y border">
                {byStage.get(stage)!.map((account) => {
                  const overdue = account.dueOn && account.dueOn < today;
                  return (
                    <li
                      key={account.id}
                      className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3"
                    >
                      <Link
                        href={`/leads/${account.id}`}
                        className="text-text min-w-0 flex-1 text-[14px] font-medium hover:underline"
                      >
                        {account.canonicalName}
                      </Link>
                      {account.nextAction && (
                        <span className="text-text-muted text-[13px]">
                          {account.nextAction}
                        </span>
                      )}
                      {account.dueOn && (
                        <span
                          className={
                            overdue
                              ? 'text-copper text-[12px] font-medium'
                              : 'text-text-subtle text-[12px]'
                          }
                          data-numeric
                        >
                          {overdue
                            ? `Overdue since ${account.dueOn}`
                            : `Due ${account.dueOn}`}
                        </span>
                      )}
                      <span className="text-text-subtle text-[12px]">
                        {account.ownerId
                          ? (memberName.get(account.ownerId) ?? 'A colleague')
                          : 'Unassigned'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </WorkspaceShell>
  );
}
