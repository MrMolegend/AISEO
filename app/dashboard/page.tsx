import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getPackage } from '@/config/packages';
import { BRAND, pageTitle } from '@/config/brand';
import { formatTokens } from '@/config/tokens';
import { stageLabel } from '@/lib/jobs/stages';
import { renderErrorCopy } from '@/lib/errors';

/*
 * Never prerendered.
 *
 * This page's output depends on who is asking. Without this, a build that
 * happens to run without Supabase credentials configured resolves the session
 * to "signed out" and bakes the redirect to sign-in into a static page, which
 * would then be served to signed-in users forever.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Dashboard'),
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/dashboard'));

  const [wallet, store] = await Promise.all([getTokenWallet(), getResearchJobStore()]);
  const [balance, jobs] = await Promise.all([
    wallet.getBalance(user.id),
    store.listForUser(user.id, 25),
  ]);

  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-ink text-[30px] font-semibold tracking-[var(--tracking-display)]">
              Your research
            </h1>
            <p className="text-ink-muted mt-1.5 tabular-nums">
              {formatTokens(balance.available)} {BRAND.currency.plural} available
              {balance.reserved > 0 && (
                <span className="text-ink-subtle">
                  {' '}
                  · {formatTokens(balance.reserved)} held against running reports
                </span>
              )}
            </p>
          </div>

          <Link
            href="/research/new"
            className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand inline-flex h-11 items-center rounded-[var(--radius-control)] px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Start new research
          </Link>
        </div>

        {jobs.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="mt-10 space-y-3">
            {jobs.map((job) => {
              const pkg = getPackage(job.packageId);
              const isDone = job.status === 'complete';
              const isFailed = job.status === 'failed' || job.status === 'cancelled';

              return (
                <li key={job.publicId}>
                  <Card>
                    <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-ink truncate text-[15px] font-semibold">
                            {job.subjectName}
                          </h2>
                          <StatusBadge job={job} />
                        </div>

                        <p className="text-ink-subtle mt-1 text-sm">
                          {pkg.name} · {formatTokens(job.tokenCost)}{' '}
                          {BRAND.currency.plural} ·{' '}
                          <time dateTime={job.createdAt}>
                            {new Date(job.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </time>
                        </p>

                        {isFailed && job.errorCode && (
                          <p className="text-ink-muted mt-2 max-w-[62ch] text-sm leading-relaxed">
                            {renderErrorCopy(job.errorCode, job.subjectDomain).body}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {isFailed ? (
                          <Link
                            href={`/research/new/${job.packageId}`}
                            className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-10 items-center rounded-[var(--radius-control)] border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                          >
                            Try again
                          </Link>
                        ) : (
                          <Link
                            href={`/research/${job.publicId}`}
                            className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-10 items-center rounded-[var(--radius-control)] border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                          >
                            {isDone ? 'Open report' : 'View progress'}
                          </Link>
                        )}
                      </div>
                    </CardBody>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

function StatusBadge({
  job,
}: {
  job: { status: string; stage: string; cachedFromJobId: string | null };
}) {
  if (job.status === 'complete') {
    return (
      <Badge tone="success" size="sm">
        Complete
      </Badge>
    );
  }
  if (job.status === 'failed' || job.status === 'cancelled') {
    return (
      <Badge tone="critical" size="sm">
        {job.status === 'cancelled' ? 'Cancelled' : 'Failed'}
      </Badge>
    );
  }
  return (
    <Badge tone="brand" size="sm">
      {stageLabel(job.stage as never)}
    </Badge>
  );
}

function EmptyState() {
  return (
    <Card className="mt-10">
      <CardBody className="py-14 text-center">
        <h2 className="text-ink text-lg font-semibold">No research yet</h2>
        <p className="text-ink-muted mx-auto mt-2 max-w-[52ch] leading-relaxed">
          Pick a package, tell us about your business, and we will build a report from
          public sources — with a link behind every claim.
        </p>
        <Link
          href="/research/new"
          className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand mt-6 inline-flex h-11 items-center rounded-[var(--radius-control)] px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Start your first report
        </Link>
      </CardBody>
    </Card>
  );
}
