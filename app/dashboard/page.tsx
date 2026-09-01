import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { DossierFilter } from '@/components/dashboard/dossier-filter';
import { BRAND, pageTitle } from '@/config/brand';
import { creditsFrom } from '@/config/report';
import { VERDICT_LABEL, type Verdict } from '@/config/design';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getEnv, researchProvidersReady, servesRealCustomers } from '@/lib/env';
import { getTokenWallet } from '@/lib/tokens';
import { getResearchJobStore, type ResearchJobRecord } from '@/lib/jobs/store';
import { getBusinessProfileStore } from '@/lib/profiles/store';
import { getResearchDraftStore } from '@/lib/drafts/store';
import { getActionItemStore } from '@/lib/actions/store';
import { reportKindLabel, isLegacyReport, targetMarketLabel } from '@/lib/jobs/labels';
import { stageLabel, isTerminal } from '@/lib/jobs/stages';
import { ACTION_PHASE_LABEL } from '@/schemas/action-item';
import { renderErrorCopy } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Intelligence Desk'),
  robots: { index: false, follow: false },
};

/**
 * The Intelligence Desk.
 *
 * A command centre, not a purchase history: what needs attention first
 * (running research, an unfinished brief, overdue actions), then the shelf
 * of profiles this account works from, then the dossier archive. A new
 * account gets the product explained in the order they will meet it —
 * profile, brief, evidence, verdict — with the refund promise stated where
 * it is most credible: before any money moves.
 *
 * Still no token figure anywhere: credits are counted here on the server and
 * that number is all the browser sees.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/dashboard'));

  const env = getEnv();
  const [wallet, store, profileStore, draftStore, actionStore] = await Promise.all([
    getTokenWallet(),
    getResearchJobStore(),
    getBusinessProfileStore(),
    getResearchDraftStore(),
    getActionItemStore(),
  ]);
  const [balance, jobs, profiles, drafts, actions] = await Promise.all([
    wallet.getBalance(user.id),
    store.listForUser(user.id, 50),
    profileStore.listForUser(user.id, { limit: 6 }),
    draftStore.listForUser(user.id, 3),
    actionStore.listForUser(user.id, { limit: 200 }),
  ]);

  const credits = creditsFrom(balance.available);
  const active = jobs.filter((job) => !isTerminal(job.status));
  const finished = jobs.filter((job) => isTerminal(job.status));

  const todayIso = new Date().toISOString().slice(0, 10);
  const openActions = actions.filter(
    (action) => action.status === 'todo' || action.status === 'in-progress',
  );
  const overdue = openActions.filter(
    (action) => action.dueDate !== null && action.dueDate < todayIso,
  );
  const nextActions = [
    ...overdue,
    ...openActions.filter((a) => !overdue.includes(a)),
  ].slice(0, 5);

  const isNew = jobs.length === 0 && profiles.length === 0 && drafts.length === 0;
  const researchDegraded = servesRealCustomers(env) && !researchProvidersReady(env);

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-page)] px-5 py-12 md:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Meta>Intelligence Desk</Meta>
            <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[40px]">
              {isNew ? 'Welcome' : 'Your working desk'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <Meta>Beta access</Meta>
              <p className="text-text mt-1 text-[15px]" data-numeric>
                {credits} {credits === 1 ? BRAND.credit.singular : BRAND.credit.plural}
              </p>
            </div>
            <Button asChild>
              <Link href="/assess">Assess a market</Link>
            </Button>
          </div>
        </div>

        {researchDegraded && (
          <Panel edge="copper" className="mt-8">
            <div className="p-5">
              <p className="text-text text-[14px] leading-relaxed">
                <strong className="font-medium">Research is temporarily offline.</strong>{' '}
                New assessments cannot start until the research provider is back; nothing
                is charged while it is down, and everything already produced remains
                available.
              </p>
            </div>
          </Panel>
        )}

        {credits === 0 && !isNew && (
          <Panel edge="copper" className="mt-8">
            <div className="p-5">
              <p className="text-text text-[14px] leading-relaxed">
                You have no {BRAND.credit.plural} left. During the beta they are granted
                manually — write to {BRAND.supportEmail} and we will sort it out.
              </p>
            </div>
          </Panel>
        )}

        {isNew ? (
          <Onboarding credits={credits} />
        ) : (
          <>
            {/* ── Needs attention ────────────────────────────────────────── */}
            {(active.length > 0 || drafts.length > 0 || overdue.length > 0) && (
              <section aria-labelledby="attention-heading" className="mt-14">
                <h2 id="attention-heading" className="sr-only">
                  Needs attention
                </h2>
                <Rule label="Needs attention" />
                <ul className="mt-4 space-y-px">
                  {active.map((job) => (
                    <ActiveRow key={job.publicId} job={job} />
                  ))}
                  {drafts.map((draft) => (
                    <li
                      key={draft.id}
                      className="border-rule bg-ground-raised border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Meta>Unfinished brief</Meta>
                          <p className="text-text mt-1.5 truncate text-[15px] font-medium">
                            {typeof draft.payload.businessName === 'string' &&
                            draft.payload.businessName.length > 0
                              ? draft.payload.businessName
                              : 'Untitled assessment'}
                          </p>
                          <Meta>
                            Saved{' '}
                            {new Date(draft.autosavedAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            — picks up exactly where you left it
                          </Meta>
                        </div>
                        <Button asChild variant="secondary" size="sm">
                          <Link href="/assess">Resume the brief</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                  {overdue.length > 0 && (
                    <li className="border-copper-line bg-ground-raised border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <Meta>Action workspace</Meta>
                          <p className="text-text mt-1.5 text-[15px]">
                            {overdue.length}{' '}
                            {overdue.length === 1 ? 'action is' : 'actions are'} past
                            their date
                          </p>
                        </div>
                        <Button asChild variant="secondary" size="sm">
                          <Link href="/actions">Open the workspace</Link>
                        </Button>
                      </div>
                    </li>
                  )}
                </ul>
              </section>
            )}

            {/* ── Profiles ───────────────────────────────────────────────── */}
            <section aria-labelledby="profiles-heading" className="mt-14">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="profiles-heading" className="sr-only">
                  Business profiles
                </h2>
                <Rule label="Business profiles" className="min-w-0 flex-1" />
                <Link
                  href="/profiles"
                  className="text-cobalt text-[13px] underline-offset-4 hover:underline"
                >
                  Manage profiles
                </Link>
              </div>
              {profiles.length === 0 ? (
                <p className="text-text-muted mt-4 text-[14px] leading-relaxed">
                  No profiles yet. A profile describes the business once — every later
                  assessment starts prefilled from it.{' '}
                  <Link
                    href="/profiles/new"
                    className="text-cobalt underline-offset-4 hover:underline"
                  >
                    Create the first one
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-4 grid grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-3">
                  {profiles.map((profile) => (
                    <li
                      key={profile.id}
                      className="border-rule bg-ground-raised border p-4"
                    >
                      <p className="text-text truncate text-[15px] font-medium">
                        {profile.name}
                      </p>
                      <Meta>
                        {profile.industry ?? 'No industry set'}
                        {profile.websiteUrl ? '' : ' · no website — and none needed'}
                      </Meta>
                      <div className="mt-3 flex gap-2">
                        <Button asChild size="sm" variant="secondary">
                          <Link href={`/assess?profile=${profile.id}`}>Assess</Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/profiles/${profile.id}`}>Edit</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ── Next actions ───────────────────────────────────────────── */}
            {nextActions.length > 0 && (
              <section aria-labelledby="actions-heading" className="mt-14">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 id="actions-heading" className="sr-only">
                    Next actions
                  </h2>
                  <Rule label="Next actions" className="min-w-0 flex-1" />
                  <Link
                    href="/actions"
                    className="text-cobalt text-[13px] underline-offset-4 hover:underline"
                  >
                    Full workspace
                  </Link>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {nextActions.map((action) => {
                    const past = action.dueDate !== null && action.dueDate < todayIso;
                    return (
                      <li
                        key={action.id}
                        className="flex flex-wrap items-baseline gap-x-3 text-[14px]"
                      >
                        <span
                          className={past ? 'text-copper' : 'text-text-faint'}
                          aria-hidden="true"
                        >
                          —
                        </span>
                        <span className="text-text min-w-0 flex-1">{action.title}</span>
                        <span className="text-text-subtle text-[12px]">
                          {ACTION_PHASE_LABEL[action.phase]}
                          {action.dueDate &&
                            ` · ${action.dueDate}${past ? ' — past its date' : ''}`}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ── Dossiers ───────────────────────────────────────────────── */}
            <section aria-labelledby="dossiers-heading" id="dossiers" className="mt-14">
              <h2 id="dossiers-heading" className="sr-only">
                Completed dossiers
              </h2>
              <Rule label={`Dossiers (${finished.length})`} />
              <div className="mt-4">
                <DossierFilter
                  count={finished.length}
                  rows={finished.map((job) => ({
                    publicId: job.publicId,
                    subject: job.subjectName,
                    market: targetMarketLabel(job) ?? '',
                    kind: reportKindLabel(job.packageId),
                    legacy: isLegacyReport(job.packageId),
                    status: job.status,
                    updatedAt: job.completedAt ?? job.createdAt,
                    verdict: verdictOf(job),
                    confidence: confidenceOf(job),
                    errorTitle:
                      job.status === 'failed'
                        ? renderErrorCopy(job.errorCode ?? 'UNKNOWN', job.subjectName)
                            .title
                        : null,
                  }))}
                />
              </div>
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

/** Reads the verdict off a stored market-entry report without parsing it whole. */
function verdictOf(job: ResearchJobRecord): Verdict | null {
  if (isLegacyReport(job.packageId) || job.status !== 'complete') return null;
  const decision = (job.report as { decision?: { verdict?: string } } | null)?.decision;
  const verdict = decision?.verdict;
  return verdict && verdict in VERDICT_LABEL ? (verdict as Verdict) : null;
}

function confidenceOf(job: ResearchJobRecord): string | null {
  if (isLegacyReport(job.packageId) || job.status !== 'complete') return null;
  const decision = (job.report as { decision?: { confidence?: string } } | null)
    ?.decision;
  return decision?.confidence ?? null;
}

function ActiveRow({ job }: { job: ResearchJobRecord }) {
  return (
    <li className="border-rule bg-ground-raised border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="bg-signal animate-node inline-block h-2 w-2"
              aria-hidden="true"
            />
            <Meta>{stageLabel(job.stage)}</Meta>
          </div>
          <p className="text-text mt-1.5 truncate text-[15px] font-medium">
            {job.subjectName}
          </p>
          {targetMarketLabel(job) && <Meta>{targetMarketLabel(job)}</Meta>}
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/research/${job.publicId}`}>Watch progress</Link>
        </Button>
      </div>
    </li>
  );
}

/**
 * The first visit, laid out as the path the customer will actually walk:
 * describe the business, brief a corridor, watch evidence gather, read a
 * verdict — with the two promises that matter most stated up front (no
 * website needed; a report that fails the evidence bar refunds itself).
 */
function Onboarding({ credits }: { credits: number }) {
  const steps = [
    {
      title: 'Describe the business once',
      body: 'A profile holds what you sell, where you operate and what makes you different. No website is asked for — a sentence you write beats a homepage we would have to guess from.',
      href: '/profiles/new',
      label: 'Create a profile',
    },
    {
      title: 'Brief the market you are weighing',
      body: 'Four short stages: the offer, the target market, your numbers, your question. Saved as you type, resumable on any device.',
      href: '/assess',
      label: 'Start a brief',
    },
    {
      title: 'The research reads the public record',
      body: 'Regulators, statistics offices, trade press, retailers. Every claim in the report cites its sources; what could not be read is listed as a limitation, never papered over.',
      href: '/methodology',
      label: 'How the research works',
    },
    {
      title: 'A verdict you can argue with',
      body: 'A readiness score built from stated factors, margin arithmetic on your own figures, and a 30/60/90 plan you can turn into a live workspace. If the evidence is too thin to be worth paying for, the report fails honestly and your credit returns automatically.',
      href: '/example',
      label: 'Read a worked example',
    },
  ];

  return (
    <section aria-label="Getting started" className="mt-14">
      <ol className="grid grid-cols-1 gap-px md:grid-cols-2">
        {steps.map((step, index) => (
          <li key={step.title} className="border-rule bg-ground-raised border p-6">
            <Meta>Step {index + 1}</Meta>
            <h2 className="font-display text-text mt-2 text-[20px] leading-snug">
              {step.title}
            </h2>
            <p className="text-text-muted mt-2 text-[14px] leading-relaxed">
              {step.body}
            </p>
            <div className="mt-4">
              <Button asChild variant={index === 0 ? 'primary' : 'secondary'} size="sm">
                <Link href={step.href}>{step.label}</Link>
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <p className="text-text-subtle mt-6 text-[13px] leading-relaxed">
        You have {credits} {credits === 1 ? BRAND.credit.singular : BRAND.credit.plural}{' '}
        to start with. One assessment costs one, and it is only kept once the report
        passes the evidence checks.
      </p>
    </section>
  );
}
