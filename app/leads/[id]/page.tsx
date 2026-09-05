import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { AccountActions } from '@/components/leads/account-actions';
import { MergePanel } from '@/components/leads/merge-panel';
import { RelationshipConfirm } from '@/components/leads/relationship-confirm';
import { DraftOutreachButton } from '@/components/leads/draft-outreach-button';
import { PipelineControls } from '@/components/leads/pipeline-controls';
import { WatchAccountButton } from '@/components/leads/watch-account-button';
import { ActivityLog } from '@/components/leads/activity-log';
import { getPipelineStore } from '@/lib/pipeline/store';
import { PIPELINE_STAGE_LABEL, type PipelineStage } from '@/schemas/pipeline';
import { ScorePanel } from '@/components/leads/score-panel';
import { getRelationshipStore } from '@/lib/relationships/store';
import { getScoreStore } from '@/lib/scoring/store';
import { matchBrands } from '@/lib/scoring/matching';
import { warmPathSentence } from '@/schemas/relationship';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getLeadStore, type LeadClaimRecord } from '@/lib/leads/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { getTeamStore } from '@/lib/team/store';
import { SEGMENT_LABEL, type SegmentKey } from '@/config/alt';
import { LEAD_STATUS_LABEL } from '@/schemas/campaign';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';

export const metadata: Metadata = {
  title: pageTitle('Account'),
  robots: { index: false, follow: false },
};

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CATEGORY_LABEL: Record<string, string> = {
  company_website: 'Company website',
  public_directory: 'Public directory',
  trade_association: 'Trade association',
  marketplace: 'Marketplace',
  news: 'News',
  event_listing: 'Event listing',
  public_search_index: 'Public search index',
  user_import: 'Imported by a colleague',
  employee_confirmation: 'Colleague confirmation',
  official_linkedin_api: 'Official LinkedIn API',
  alt_internal: 'ALT internal record',
  inference: 'Inference from cited evidence',
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  verified: 'Verified',
  likely: 'Likely current',
  unverified: 'Unverified',
};

/**
 * The account intelligence page.
 *
 * Facts, sources and unknowns are visually distinct: every claim renders
 * with its source, category, confidence and retrieval date; contacts carry
 * their employment confidence in words; what research could not establish
 * is said plainly rather than papered over.
 */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const membership = await requireWorkspacePage(`/leads/${id}`);
  if (!UUID_SHAPE.test(id)) notFound();

  const store = await getLeadStore();
  const account = await store.getAccount(id);
  if (!account) notFound();
  if (account.status === 'merged' && account.mergedInto) {
    redirect(`/leads/${account.mergedInto}`);
  }

  const config = await getAltConfigStore();
  const team = await getTeamStore();
  const [claims, contacts, merges, territories, members] = await Promise.all([
    store.listClaims(id),
    store.listContacts(id),
    store.listMerges(id),
    config.listTerritories(),
    team.list(),
  ]);
  const territoryName = new Map(territories.map((t) => [t.key, t.name]));
  const memberName = new Map(members.map((m) => [m.userId, m.displayName]));

  const scoreStore = await getScoreStore();
  const pipeline = await getPipelineStore();
  const [score, brands, playbooks, activities, stageHistory] = await Promise.all([
    scoreStore.get(id),
    config.listBrands(),
    config.getConfig('playbooks'),
    pipeline.activitiesForAccount(id, membership.user.id),
    pipeline.historyForAccount(id),
  ]);
  const matches = brands.length > 0 ? matchBrands(account, claims, brands) : [];

  const relationshipStore = await getRelationshipStore();
  const edgesByContact = new Map(
    await Promise.all(
      contacts.map(
        async (contact) =>
          [contact.id, await relationshipStore.forContact(contact.id)] as const,
      ),
    ),
  );

  const identity = claims.filter((claim) => claim.kind === 'identity');
  const fit = claims.filter((claim) => claim.kind === 'fit');
  const contactClaims = claims.filter((claim) => claim.kind === 'contact');
  const signals = claims.filter((claim) => claim.kind === 'signal');

  const canWork = (ROLES_WHO_WORK_LEADS as readonly string[]).includes(
    membership.member.role,
  );
  const canMerge = ['super_admin', 'sales_manager', 'analyst'].includes(
    membership.member.role,
  );

  // Merge candidates: other accounts in the same campaign, not merged.
  const siblings = account.campaignId
    ? (await store.listAccounts({ campaignId: account.campaignId, limit: 100 })).filter(
        (sibling) => sibling.id !== account.id,
      )
    : [];
  const nameOf: Record<string, string> = { [account.id]: account.canonicalName };
  for (const sibling of siblings) nameOf[sibling.id] = sibling.canonicalName;

  return (
    <WorkspaceShell
      kicker={`Account — ${LEAD_STATUS_LABEL[account.status]}`}
      title={account.canonicalName}
      intro={account.summary ?? undefined}
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
        <Meta>
          {account.ownerId
            ? `Owner: ${memberName.get(account.ownerId) ?? 'a colleague'}`
            : 'Unassigned'}
        </Meta>
        {account.websiteUrl ? (
          <a
            href={account.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal text-[12px] tracking-wide uppercase hover:underline"
          >
            Website ↗
          </a>
        ) : (
          <Meta>No website found — not required</Meta>
        )}
      </div>

      <AccountActions
        accountId={account.id}
        status={account.status}
        ownerId={account.ownerId}
        selfId={membership.user.id}
        canWork={canWork}
      />

      {canWork && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <WatchAccountButton
            accountId={account.id}
            accountName={account.canonicalName}
          />
          <Link
            href={`/leads/${account.id}/brief`}
            className="text-text-muted text-[13px] underline-offset-2 hover:underline"
          >
            Meeting brief →
          </Link>
        </div>
      )}

      {canWork && (
        <PipelineControls
          accountId={account.id}
          currentStage={account.pipelineStage}
          playbooks={playbooks.map((playbook) => ({
            key: playbook.key,
            name: playbook.name,
          }))}
        />
      )}
      {account.pipelineStage && (
        <p className="text-text-muted mt-3 text-[13px]">
          Currently:{' '}
          {PIPELINE_STAGE_LABEL[account.pipelineStage as PipelineStage] ??
            account.pipelineStage}
          {stageHistory[0]?.note ? ` — ${stageHistory[0].note}` : ''}
        </p>
      )}

      {account.fitRationale && (
        <Panel className="mt-8 p-6">
          <Meta>Why this status</Meta>
          <p className="text-text mt-2 text-[14px] leading-relaxed">
            {account.fitRationale}
          </p>
        </Panel>
      )}

      {canWork && (
        <ScorePanel
          accountId={account.id}
          canOverride={['super_admin', 'sales_manager'].includes(membership.member.role)}
          score={
            score
              ? {
                  total: score.total,
                  components: score.components,
                  computedAt: score.computedAt,
                  overrideTotal: score.overrideTotal,
                  overrideReason: score.overrideReason,
                }
              : null
          }
          matches={matches.map((match) => ({
            brandId: match.brandId,
            brandName: match.brandName,
            verdict: match.verdict,
            explanation: match.explanation,
          }))}
        />
      )}

      <Rule label="Decision-makers" className="mt-12" />
      {contacts.length === 0 ? (
        <p className="text-text-muted mt-4 text-[14px] leading-relaxed">
          No decision-makers found in public sources yet. That is a statement about the
          public record, not about the business — a colleague who knows the buyer can add
          them from an authorised import or confirmation.
        </p>
      ) : (
        <ul className="border-rule divide-rule mt-4 divide-y border">
          {contacts.map((contact) => (
            <li key={contact.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <p className="text-text text-[14px] font-medium">{contact.fullName}</p>
                {contact.roleTitle && (
                  <p className="text-text-muted text-[13px]">{contact.roleTitle}</p>
                )}
                <span className="text-text-subtle text-[11px] font-medium tracking-wide uppercase">
                  {EMPLOYMENT_LABEL[contact.employmentConfidence]}
                </span>
              </div>
              {contact.roleRelevance && (
                <p className="text-text-subtle mt-1 text-[13px] leading-relaxed">
                  {contact.roleRelevance}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                {contact.profileUrl && (
                  <a
                    href={contact.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-signal text-[12px] hover:underline"
                  >
                    Public profile ↗
                  </a>
                )}
                {contact.sourceUrl && (
                  <span className="text-text-subtle text-[12px]">
                    Source:{' '}
                    {CATEGORY_LABEL[contact.sourceCategory] ?? contact.sourceCategory}
                  </span>
                )}
              </div>
              {canWork && (
                <div className="mt-2">
                  <DraftOutreachButton
                    accountId={account.id}
                    contactId={contact.id}
                    language="en"
                  />
                </div>
              )}
              {canWork && (
                <RelationshipConfirm
                  contactId={contact.id}
                  ownState={
                    edgesByContact
                      .get(contact.id)
                      ?.find((edge) => edge.employeeId === membership.user.id)?.state ??
                    null
                  }
                  sentences={(edgesByContact.get(contact.id) ?? [])
                    .filter(
                      (edge) =>
                        edge.visibility === 'workspace' &&
                        edge.state !== 'rejected_or_stale',
                    )
                    .map((edge) =>
                      warmPathSentence(
                        edge.state,
                        memberName.get(edge.employeeId) ?? 'a colleague',
                      ),
                    )}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <Rule label="Evidence" className="mt-12" />
      <div className="mt-4 space-y-8">
        <ClaimGroup title="Identity" claims={identity} />
        <ClaimGroup title="Fit" claims={fit} />
        {contactClaims.length > 0 && <ClaimGroup title="People" claims={contactClaims} />}
        {signals.length > 0 && <ClaimGroup title="Signals" claims={signals} />}
        {claims.length === 0 && (
          <p className="text-text-muted text-[14px]">
            No evidence recorded yet. Nothing about this account should be trusted until
            research attaches sources.
          </p>
        )}
      </div>

      {canWork && (
        <>
          <Rule label="Activity" className="mt-12" />
          <div className="mt-4">
            <ActivityLog
              accountId={account.id}
              activities={activities.map((activity) => ({
                id: activity.id,
                kind: activity.kind,
                body: activity.body,
                private: activity.private,
                authorName: activity.authorId
                  ? (memberName.get(activity.authorId) ?? 'A colleague')
                  : 'Unknown',
                happenedAt: activity.happenedAt,
              }))}
            />
          </div>
        </>
      )}

      {canMerge && (
        <MergePanel
          accountId={account.id}
          candidates={siblings.map((sibling) => ({
            id: sibling.id,
            name: sibling.canonicalName,
          }))}
          history={merges.map((merge) => ({
            id: merge.id,
            winnerId: merge.winnerId,
            loserId: merge.loserId,
            reason: merge.reason,
            undoneAt: merge.undoneAt,
            createdAt: merge.createdAt,
          }))}
          nameOf={nameOf}
        />
      )}

      {account.campaignId && (
        <p className="mt-12">
          <Link
            href={`/leads?campaign=${account.campaignId}`}
            className="text-text-muted text-[13px] hover:underline"
          >
            ← All accounts from this campaign
          </Link>
        </p>
      )}
    </WorkspaceShell>
  );
}

function ClaimGroup({ title, claims }: { title: string; claims: LeadClaimRecord[] }) {
  if (claims.length === 0) {
    return (
      <div>
        <h3 className="text-text text-[13px] font-medium">{title}</h3>
        <p className="text-text-subtle mt-2 text-[13px]">
          Nothing established — recorded as unknown, not assumed.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-text text-[13px] font-medium">
        {title}{' '}
        <span className="text-text-subtle font-normal" data-numeric>
          ({claims.length})
        </span>
      </h3>
      <ul className="border-rule divide-rule mt-2 divide-y border">
        {claims.map((claim) => (
          <li key={claim.id} className="px-4 py-3">
            <p className="text-text text-[13px] leading-relaxed">{claim.text}</p>
            <p className="text-text-subtle mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
              <a
                href={claim.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-signal hover:underline"
              >
                {claim.sourceTitle ?? claim.sourceUrl} ↗
              </a>
              <span>{CATEGORY_LABEL[claim.sourceCategory] ?? claim.sourceCategory}</span>
              <span>
                {claim.retrievalMode === 'indexed' ? 'Indexed snippet' : 'Read directly'}
              </span>
              <span>Confidence: {claim.confidence}</span>
              <span data-numeric>
                Retrieved {claim.retrievedAt.slice(0, 10)}
                {claim.contentDate ? ` · published ${claim.contentDate}` : ''}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
