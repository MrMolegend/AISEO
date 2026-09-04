import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { RepairButton } from '@/components/admin/repair-button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getEnv } from '@/lib/env';
import { getResearchJobStore } from '@/lib/jobs/store';
import { stallCutoffIso } from '@/lib/jobs/recovery';
import { getReportFeedbackStore } from '@/lib/feedback/store';
import { getShareLinkStore } from '@/lib/share/store';
import { isPlatformError } from '@/lib/errors';
import Link from 'next/link';
import { RepairCampaignsButton } from '@/components/admin/repair-campaigns-button';
import { capabilityReport } from '@/lib/linkedin/provider';
import { getCampaignStore } from '@/lib/campaigns/store';
import { runStallCutoffIso } from '@/lib/discovery/start';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { getSignalStore } from '@/lib/signals/store';
import { getTeamStore } from '@/lib/team/store';
import { getOutreachStore } from '@/lib/outreach/store';
import { ROLE_LABEL, type AltRole } from '@/schemas/team';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Operations'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * The operations console.
 *
 * Narrow on purpose: recent jobs and their health, stalled runs with one
 * audited repair action, feedback aggregates, share-link audit events, and
 * which providers are configured — names and states, never keys, prompts,
 * raw provider payloads or full customer content.
 *
 * Authorisation is the server-issued role claim (see lib/auth/admin.ts);
 * a non-admin gets the same 404 as a mistyped URL, because an admin page
 * that answers "forbidden" has confirmed it exists.
 */
export default async function AdminPage() {
  try {
    const { requireAdmin } = await import('@/lib/auth/admin');
    await requireAdmin();
  } catch (error) {
    if (isPlatformError(error)) notFound();
    throw error;
  }

  const env = getEnv();
  const store = await getResearchJobStore();
  const [recent, stalled, aggregates, shareEvents] = await Promise.all([
    store.listRecentAll(30),
    store.listStale(stallCutoffIso(), 20),
    (await getReportFeedbackStore()).aggregate(20),
    (await getShareLinkStore()).recentEvents(30),
  ]);

  const providers = [
    { name: 'AI synthesis', state: env.AI_PROVIDER },
    { name: 'Web research', state: env.RESEARCH_PROVIDER },
    {
      name: 'Rate limiting',
      state: env.UPSTASH_REDIS_REST_URL ? 'upstash' : 'memory',
    },
    {
      name: 'Storage',
      state: env.SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'memory',
    },
    { name: 'Google Places', state: 'disabled — not part of this product' },
  ];

  const shortId = (value: string) => `${value.slice(0, 8)}…`;

  // ── Lead-intelligence operations ──────────────────────────────────────
  const startOfTodayUtc = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const today = new Date().toISOString().slice(0, 10);
  const [campaigns, config, signals, team, outreach] = await Promise.all([
    getCampaignStore(),
    getAltConfigStore(),
    getSignalStore(),
    getTeamStore(),
    getOutreachStore(),
  ]);
  const [stalledRuns, caps, campaignUnitsToday, checkUnitsToday, members, suppression] =
    await Promise.all([
      campaigns.listStaleRuns(runStallCutoffIso()),
      config.getConfig('budget_caps'),
      campaigns.unitsSpentSince(startOfTodayUtc),
      signals.checksUsedOn(today),
      team.list(),
      outreach.listSuppression(),
    ]);
  const linkedIn = capabilityReport([]);
  const roleCounts = new Map<AltRole, number>();
  for (const member of members) {
    if (member.status !== 'active') continue;
    roleCounts.set(member.role, (roleCounts.get(member.role) ?? 0) + 1);
  }

  return (
    <>
      <SiteHeader />
      <main
        id="main"
        className="mx-auto max-w-[var(--container-content)] px-5 py-12 md:py-16"
      >
        <Meta>Operations</Meta>
        <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[40px]">
          The desk behind the desk.
        </h1>

        {/* ── Providers ──────────────────────────────────────────────────── */}
        <section aria-labelledby="providers-heading" className="mt-10">
          <h2 id="providers-heading" className="text-text text-[16px] font-medium">
            Providers
          </h2>
          <Rule className="mt-2" />
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {providers.map((provider) => (
              <div
                key={provider.name}
                className="flex items-baseline justify-between gap-4"
              >
                <dt className="text-text-muted text-[13px]">{provider.name}</dt>
                <dd className="text-text text-[13px]">{provider.state}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── LinkedIn capabilities ──────────────────────────────────────── */}
        <section aria-labelledby="linkedin-heading" className="mt-12">
          <h2 id="linkedin-heading" className="text-text text-[16px] font-medium">
            LinkedIn capabilities
          </h2>
          <Rule className="mt-2" />
          <p className="text-text-muted mt-3 text-[13px]">
            Mode: <span className="text-text">{linkedIn.mode}</span>
            {' · '}
            {linkedIn.configured
              ? 'credentials configured'
              : 'credentials not configured'}
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {Object.entries(linkedIn.capabilities).map(([capability, available]) => (
              <div key={capability} className="flex items-baseline justify-between gap-4">
                <dt className="text-text-muted text-[13px]">
                  {capability.replaceAll('_', ' ')}
                </dt>
                <dd
                  className={
                    available ? 'text-signal text-[13px]' : 'text-text-subtle text-[13px]'
                  }
                >
                  {available ? 'available' : 'off'}
                </dd>
              </div>
            ))}
          </dl>
          <ul className="mt-3 space-y-1">
            {linkedIn.notes.map((note, index) => (
              <li key={index} className="text-text-subtle text-[13px]">
                {note}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Research budgets ───────────────────────────────────────────── */}
        <section aria-labelledby="budgets-heading" className="mt-12">
          <h2 id="budgets-heading" className="text-text text-[16px] font-medium">
            Research budgets
          </h2>
          <Rule className="mt-2" />
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted text-[13px]">Per-campaign cap</dt>
              <dd className="text-text text-[13px]" data-numeric>
                {caps.perCampaignUnits} units
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted text-[13px]">Workspace daily cap</dt>
              <dd className="text-text text-[13px]" data-numeric>
                {caps.perDayUnits} units
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted text-[13px]">Spent today — campaigns</dt>
              <dd className="text-text text-[13px]" data-numeric>
                {campaignUnitsToday} units
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted text-[13px]">Spent today — watch checks</dt>
              <dd className="text-text text-[13px]" data-numeric>
                {checkUnitsToday} units
              </dd>
            </div>
          </dl>
          <p className="text-text-subtle mt-3 text-[13px]">
            Caps are configuration, changed on the{' '}
            <Link href="/commercial" className="underline-offset-2 hover:underline">
              commercial page
            </Link>
            . Both campaign discovery and watchlist checks spend from the same daily cap.
          </p>
        </section>

        {/* ── Campaign runs ──────────────────────────────────────────────── */}
        <section aria-labelledby="campaign-runs-heading" className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="campaign-runs-heading" className="text-text text-[16px] font-medium">
              Stalled campaign runs
            </h2>
            <RepairCampaignsButton count={stalledRuns.length} />
          </div>
          <Rule className="mt-2" />
          {stalledRuns.length === 0 ? (
            <p className="text-text-faint mt-3 text-[13px]">
              No discovery run has gone quiet. Runs without a heartbeat past the stall
              window would appear here.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {stalledRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-baseline gap-x-4 text-[13px]"
                >
                  <span className="text-text" data-numeric>
                    run {shortId(run.id)}
                  </span>
                  <span className="text-text-muted">stage {run.stage}</span>
                  <span className="text-text-subtle" data-numeric>
                    campaign {shortId(run.campaignId)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Team and suppression ───────────────────────────────────────── */}
        <section aria-labelledby="team-heading" className="mt-12">
          <h2 id="team-heading" className="text-text text-[16px] font-medium">
            Team and suppression
          </h2>
          <Rule className="mt-2" />
          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...roleCounts.entries()].map(([role, count]) => (
              <div key={role} className="flex items-baseline justify-between gap-4">
                <dt className="text-text-muted text-[13px]">{ROLE_LABEL[role]}</dt>
                <dd className="text-text text-[13px]" data-numeric>
                  {count}
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-text-muted text-[13px]">Suppression entries</dt>
              <dd className="text-text text-[13px]" data-numeric>
                {suppression.length}
              </dd>
            </div>
          </dl>
          <p className="text-text-subtle mt-3 text-[13px]">
            Membership is managed on the{' '}
            <Link href="/team" className="underline-offset-2 hover:underline">
              team page
            </Link>
            ; CSV account imports live at{' '}
            <Link href="/imports" className="underline-offset-2 hover:underline">
              /imports
            </Link>
            .
          </p>
        </section>

        {/* ── Stalled jobs ───────────────────────────────────────────────── */}
        <section aria-labelledby="stalled-heading" className="mt-12">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="stalled-heading" className="text-text text-[16px] font-medium">
              Stalled runs
            </h2>
            <RepairButton count={stalled.length} />
          </div>
          <Rule className="mt-2" />
          {stalled.length === 0 ? (
            <p className="text-text-faint mt-3 text-[13px]">
              Nothing is stalled. Runs older than {env.JOB_STALL_MINUTES} minutes without
              a heartbeat would appear here.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {stalled.map((job) => (
                <li
                  key={job.id}
                  className="flex flex-wrap items-baseline gap-x-4 text-[13px]"
                >
                  <span className="text-text" data-numeric>
                    {job.publicId}
                  </span>
                  <span className="text-text-muted">stage {job.stage}</span>
                  <span className="text-text-subtle" data-numeric>
                    attempt {job.attemptCount} · last pulse {job.heartbeatAt ?? 'never'} ·
                    user {shortId(job.userId)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Recent jobs ────────────────────────────────────────────────── */}
        <section aria-labelledby="recent-heading" className="mt-12">
          <h2 id="recent-heading" className="text-text text-[16px] font-medium">
            Recent runs
          </h2>
          <Rule className="mt-2" />
          {/* Scrolls sideways on a phone, so it must be reachable by
              keyboard: focusable, and named for whoever lands on it. */}
          <div
            className="mt-3 overflow-x-auto"
            role="region"
            aria-label="Recent runs"
            tabIndex={0}
          >
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="text-text-subtle">
                  <th className="pr-4 pb-2 font-normal">Report</th>
                  <th className="pr-4 pb-2 font-normal">Status</th>
                  <th className="pr-4 pb-2 font-normal">Stage</th>
                  <th className="pr-4 pb-2 font-normal">Error</th>
                  <th className="pr-4 pb-2 font-normal">Attempts</th>
                  <th className="pb-2 font-normal">Started</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((job) => (
                  <tr key={job.id} className="border-rule border-t">
                    <td className="text-text py-1.5 pr-4" data-numeric>
                      {job.publicId}
                    </td>
                    <td className="text-text-muted py-1.5 pr-4">{job.status}</td>
                    <td className="text-text-muted py-1.5 pr-4">{job.stage}</td>
                    <td className="text-copper py-1.5 pr-4">{job.errorCode ?? '—'}</td>
                    <td className="text-text-muted py-1.5 pr-4" data-numeric>
                      {job.attemptCount}
                    </td>
                    <td className="text-text-subtle py-1.5" data-numeric>
                      {job.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Feedback aggregates ────────────────────────────────────────── */}
        <section aria-labelledby="feedback-heading" className="mt-12">
          <h2 id="feedback-heading" className="text-text text-[16px] font-medium">
            Report feedback
          </h2>
          <Rule className="mt-2" />
          {aggregates.length === 0 ? (
            <p className="text-text-faint mt-3 text-[13px]">No feedback yet.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {aggregates.map((entry) => (
                <li
                  key={entry.jobId}
                  className="flex flex-wrap items-baseline gap-x-4 text-[13px]"
                >
                  <span className="text-text" data-numeric>
                    job {shortId(entry.jobId)}
                  </span>
                  <span className="text-signal" data-numeric>
                    {entry.usefulCount} useful
                  </span>
                  <span className="text-copper" data-numeric>
                    {entry.notUsefulCount} not useful
                  </span>
                  <span className="text-text-subtle">
                    {Object.entries(entry.categories)
                      .map(([category, count]) => `${category} ×${count}`)
                      .join(' · ') || 'no categories'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ── Share audit ────────────────────────────────────────────────── */}
        <section aria-labelledby="shares-heading" className="mt-12">
          <h2 id="shares-heading" className="text-text text-[16px] font-medium">
            Share-link events
          </h2>
          <Rule className="mt-2" />
          {shareEvents.length === 0 ? (
            <p className="text-text-faint mt-3 text-[13px]">No share activity yet.</p>
          ) : (
            <ul className="mt-3 space-y-1">
              {shareEvents.map((event, index) => (
                <li
                  key={`${event.shareId}-${event.createdAt}-${index}`}
                  className="flex flex-wrap items-baseline gap-x-4 text-[13px]"
                >
                  <span className="text-text-subtle" data-numeric>
                    {event.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                  <span
                    className={
                      event.event === 'denied' ? 'text-copper' : 'text-text-muted'
                    }
                  >
                    {event.event}
                  </span>
                  <span className="text-text-faint" data-numeric>
                    link {shortId(event.shareId)}
                    {event.ipHash ? ` · viewer ${event.ipHash.slice(0, 8)}…` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Panel className="mt-14">
          <div className="p-4">
            <p className="text-text-subtle text-[13px] leading-relaxed">
              This console shows operational metadata only: no report contents, no
              prompts, no provider payloads, no tokens, no keys. Token grants remain a
              separate operator action through the secret-gated API route.
            </p>
          </div>
        </Panel>
      </main>
      <SiteFooter />
    </>
  );
}
