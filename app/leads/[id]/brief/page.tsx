import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { getLeadStore } from '@/lib/leads/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { getScoreStore } from '@/lib/scoring/store';
import { getPipelineStore } from '@/lib/pipeline/store';
import { getRelationshipStore } from '@/lib/relationships/store';
import { getTeamStore } from '@/lib/team/store';
import { matchBrands } from '@/lib/scoring/matching';
import { warmPathSentence } from '@/schemas/relationship';
import { PIPELINE_STAGE_LABEL, type PipelineStage } from '@/schemas/pipeline';
import { SEGMENT_LABEL, type SegmentKey } from '@/config/alt';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';

/**
 * The meeting brief: one page a rep reads before walking in.
 *
 * Everything on it is assembled from stored, sourced records — claims with
 * their URLs, the score decomposition, confirmed relationship paths, open
 * tasks, recent activity, and ALT proof points that carry their own
 * provenance. Nothing is generated for the occasion; talking points are the
 * observed product matches, verbatim from the matching engine, so a rep
 * never carries a claim the evidence does not.
 */

export const metadata: Metadata = {
  title: pageTitle('Meeting brief'),
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const membership = await requireWorkspacePage(
    `/leads/${id}/brief`,
    ...ROLES_WHO_WORK_LEADS,
  );

  const store = await getLeadStore();
  const account = await store.getAccount(id);
  if (!account || account.status === 'merged') notFound();

  const [config, scoreStore, pipeline, relationships, team] = await Promise.all([
    getAltConfigStore(),
    getScoreStore(),
    getPipelineStore(),
    getRelationshipStore(),
    getTeamStore(),
  ]);
  const [
    claims,
    contacts,
    score,
    brands,
    proofPoints,
    tasks,
    activities,
    territories,
    members,
  ] = await Promise.all([
    store.listClaims(account.id),
    store.listContacts(account.id),
    scoreStore.get(account.id),
    config.listBrands(),
    config.getConfig('proof_points'),
    pipeline.tasksForAccount(account.id),
    pipeline.activitiesForAccount(account.id, membership.user.id),
    config.listTerritories(),
    team.list(),
  ]);

  const memberName = new Map(
    members.map((member) => [member.userId, member.displayName]),
  );
  const territoryName = new Map(
    territories.map((territory) => [territory.key, territory.name]),
  );
  const matches = brands.length > 0 ? matchBrands(account, claims, brands) : [];
  const observed = matches.filter((match) => match.verdict === 'observed_opportunity');
  const openTasks = tasks.filter((task) => task.status === 'open');
  const warmPaths = (
    await Promise.all(
      contacts.map(async (contact) => {
        const edges = await relationships.forContact(contact.id);
        return edges
          .filter((edge) => edge.state !== 'rejected_or_stale')
          .map((edge) => ({
            contactName: contact.fullName,
            sentence: warmPathSentence(
              edge.state,
              memberName.get(edge.employeeId) ?? 'a colleague',
            ),
          }));
      }),
    )
  ).flat();

  return (
    <WorkspaceShell
      kicker="Meeting brief"
      title={account.canonicalName}
      intro="Assembled from stored, sourced records only. Print it, read it, walk in."
      actions={
        <Link
          href={`/leads/${account.id}`}
          className="text-text-muted text-[13px] underline-offset-2 hover:underline"
        >
          ← Back to the account
        </Link>
      }
    >
      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
        <Meta>
          {account.segmentKey
            ? (SEGMENT_LABEL[account.segmentKey as SegmentKey] ?? account.segmentKey)
            : 'Segment unknown'}
        </Meta>
        <Meta>
          {account.territoryKey
            ? (territoryName.get(account.territoryKey) ?? account.territoryKey)
            : 'Territory unknown'}
        </Meta>
        {account.pipelineStage && (
          <Meta>
            Stage:{' '}
            {PIPELINE_STAGE_LABEL[account.pipelineStage as PipelineStage] ??
              account.pipelineStage}
          </Meta>
        )}
      </div>

      {account.fitRationale && (
        <Panel className="mt-8 p-6">
          <Meta>Why this account</Meta>
          <p className="text-text mt-2 text-[14px] leading-relaxed">
            {account.fitRationale}
          </p>
        </Panel>
      )}

      <Rule label="Talking points from observed evidence" className="mt-12" />
      {observed.length === 0 ? (
        <p className="text-text-muted mt-4 text-[14px] leading-relaxed">
          No observed product opportunities yet. Absence of evidence is not a gap — it
          only means nothing has been verified either way.
        </p>
      ) : (
        <ul className="mt-4 max-w-3xl space-y-3">
          {observed.map((match) => (
            <li key={match.brandId} className="border-rule border p-4">
              <p className="text-text text-[14px] font-medium">{match.brandName}</p>
              <p className="text-text-muted mt-1 text-[13px]">{match.explanation}</p>
            </li>
          ))}
        </ul>
      )}

      <Rule label="Warm paths" className="mt-12" />
      {warmPaths.length === 0 ? (
        <p className="text-text-muted mt-4 text-[14px] leading-relaxed">
          No confirmed relationship paths. Treat this as a cold conversation.
        </p>
      ) : (
        <ul className="mt-4 max-w-3xl space-y-2">
          {warmPaths.map((path, index) => (
            <li key={index} className="text-text text-[14px]">
              <span className="font-medium">{path.contactName}:</span>{' '}
              <span className="text-text-muted">{path.sentence}</span>
            </li>
          ))}
        </ul>
      )}

      <Rule label="Score decomposition" className="mt-12" />
      {!score ? (
        <p className="text-text-muted mt-4 text-[14px]">Not scored yet.</p>
      ) : (
        <div className="mt-4 max-w-3xl">
          <p className="text-text text-[14px]">
            Total {score.overrideTotal ?? score.total} of 100
            {score.overrideTotal !== null && (
              <span className="text-text-subtle">
                {' '}
                (overridden from {score.total}: {score.overrideReason})
              </span>
            )}
          </p>
          <ul className="mt-3 space-y-1">
            {score.components.map((component) => (
              <li key={component.dimension} className="flex gap-3 text-[13px]">
                <span className="text-text-muted w-44 shrink-0">{component.label}</span>
                <span className="text-text" data-numeric>
                  {component.missing ? '—' : component.raw}
                </span>
                <span className="text-text-subtle min-w-0 flex-1">
                  {component.missing
                    ? `Missing: ${component.missingInputs.join(', ')}`
                    : component.explanation}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Rule label="Evidence" className="mt-12" />
      {claims.length === 0 ? (
        <p className="text-text-muted mt-4 text-[14px]">No stored evidence.</p>
      ) : (
        <ul className="mt-4 max-w-3xl space-y-3">
          {claims.slice(0, 12).map((claim) => (
            <li key={claim.id} className="text-[13px]">
              <p className="text-text">{claim.text}</p>
              <p className="text-text-subtle mt-0.5">
                {claim.sourceTitle ?? new URL(claim.sourceUrl).hostname} ·{' '}
                {claim.retrievalMode === 'indexed' ? 'search index' : 'page'} ·{' '}
                {claim.confidence} confidence
              </p>
            </li>
          ))}
        </ul>
      )}

      <Rule label="Open tasks and recent activity" className="mt-12" />
      <div className="mt-4 grid max-w-4xl gap-8 md:grid-cols-2">
        <div>
          {openTasks.length === 0 ? (
            <p className="text-text-muted text-[14px]">No open tasks.</p>
          ) : (
            <ul className="space-y-2">
              {openTasks.map((task) => (
                <li key={task.id} className="text-text text-[13px]">
                  {task.title}
                  {task.dueOn && (
                    <span className="text-text-subtle"> — due {task.dueOn}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {activities.length === 0 ? (
            <p className="text-text-muted text-[14px]">No recorded activity.</p>
          ) : (
            <ul className="space-y-2">
              {activities.slice(0, 6).map((activity) => (
                <li key={activity.id} className="text-text-muted text-[13px]">
                  <span className="text-text-subtle uppercase">{activity.kind}</span>{' '}
                  {activity.body}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Rule label="About Arab Land Trading" className="mt-12" />
      <ul className="mt-4 max-w-3xl space-y-1">
        {proofPoints.map((point, index) => (
          <li key={index} className="text-[13px]">
            <span className="text-text">{point.text}</span>{' '}
            <span className="text-text-subtle">
              ({point.source.replaceAll('_', ' ')}, {point.recordedOn})
            </span>
          </li>
        ))}
      </ul>
    </WorkspaceShell>
  );
}
