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
import { getTokenWallet } from '@/lib/tokens';
import { getResearchJobStore, type ResearchJobRecord } from '@/lib/jobs/store';
import { reportKindLabel, isLegacyReport, targetMarketLabel } from '@/lib/jobs/labels';
import { stageLabel, isTerminal } from '@/lib/jobs/stages';
import { renderErrorCopy } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Intelligence Desk'),
  robots: { index: false, follow: false },
};

/**
 * The Intelligence Desk.
 *
 * A working surface rather than a list of purchases: what is running now, what
 * has been decided, and one way to start the next thing. Deliberately shows no
 * package cards and no token figure — the customer counts reports, and the
 * conversion happens here on the server so no token number reaches the browser.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/dashboard'));

  const [wallet, store] = await Promise.all([getTokenWallet(), getResearchJobStore()]);
  const [balance, jobs] = await Promise.all([
    wallet.getBalance(user.id),
    store.listForUser(user.id, 50),
  ]);

  const credits = creditsFrom(balance.available);
  const active = jobs.filter((job) => !isTerminal(job.status));
  const finished = jobs.filter((job) => isTerminal(job.status));

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
              {jobs.length === 0 ? 'Welcome' : 'Your market assessments'}
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

        {credits === 0 && (
          <Panel edge="copper" className="mt-8">
            <div className="p-5">
              <p className="text-text text-[14px] leading-relaxed">
                You have no {BRAND.credit.plural} left. During the beta they are granted
                manually — write to {BRAND.supportEmail} and we will sort it out.
              </p>
            </div>
          </Panel>
        )}

        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {active.length > 0 && (
              <section aria-labelledby="active-heading" className="mt-14">
                <h2 id="active-heading" className="sr-only">
                  Research in progress
                </h2>
                <Rule label="In progress" />
                <ul className="mt-4 space-y-px">
                  {active.map((job) => (
                    <ActiveRow key={job.publicId} job={job} />
                  ))}
                </ul>
              </section>
            )}

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

function EmptyState() {
  return (
    <Panel edge="signal" className="mt-14">
      <div className="p-8 md:p-10">
        <h2 className="font-display text-text text-[24px] leading-tight">
          Nothing here yet
        </h2>
        <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
          An assessment takes about ten minutes to brief and three to eight to run. You
          will need to know what you sell, where you want to take it, and what you are
          trying to decide — there is no website address to find and nothing to upload.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/assess">Assess a market</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/example">Read a worked example first</Link>
          </Button>
        </div>
      </div>
    </Panel>
  );
}
