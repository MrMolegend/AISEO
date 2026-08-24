import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ProcessingScreen } from '@/components/research/processing-screen';
import { ReportView } from '@/components/research/report/report-view';
import { getCurrentUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getPackage } from '@/config/packages';
import { pageTitle } from '@/config/brand';
import { renderErrorCopy } from '@/lib/errors';
import type { StoredSource } from '@/schemas/research/shared';
import Link from 'next/link';

/**
 * One route, three states: running, failed, complete.
 *
 * Keeping them on one URL is what makes the link shareable and refresh-safe
 * from the moment the job is created. The alternative — redirecting when the
 * job finishes — means the link a user copied while waiting stops working.
 *
 * Access is resolved in a deliberate order. The owner's view is tried first so
 * that an owner watching an unfinished job sees progress rather than a 404 from
 * the public path. The public path only ever returns a completed report, which
 * is what makes the capability link safe to share.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const store = await getResearchJobStore();
  const job = await store.getPublic(publicId);

  return {
    title: pageTitle(job ? `${job.subjectName} — research` : 'Research'),
    // Never indexed. These pages are about real businesses, contain a
    // customer's own brief, and are shared by capability link rather than
    // published.
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const user = await getCurrentUser();
  const store = await getResearchJobStore();

  const ownedJob = user ? await store.getForUser(publicId, user.id) : null;
  const job = ownedJob ?? (await store.getPublic(publicId));

  if (!job) notFound();

  const isOwner = Boolean(ownedJob);
  const pkg = getPackage(job.packageId);

  /* ── Failed ────────────────────────────────────────────────────────── */
  if (job.status === 'failed' || job.status === 'cancelled') {
    const copy = renderErrorCopy(
      job.errorCode ?? 'UNKNOWN',
      job.subjectDomain ?? job.subjectName,
    );

    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-[560px] px-5 py-16">
          <div
            role="alert"
            className="rounded-[var(--radius-card)] border border-[var(--color-severity-critical-line)] bg-[var(--color-severity-critical-bg)] p-6"
          >
            <h1 className="text-ink text-lg font-semibold">{copy.title}</h1>
            <p className="text-ink-muted mt-2 leading-relaxed">{copy.body}</p>
          </div>

          {isOwner && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/research/new/${job.packageId}`}
                className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand inline-flex h-11 items-center rounded-[var(--radius-control)] px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Try again
              </Link>
              <Link
                href="/dashboard"
                className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-11 items-center rounded-[var(--radius-control)] border px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Back to dashboard
              </Link>
            </div>
          )}
        </main>
        <SiteFooter />
      </>
    );
  }

  /* ── Running ───────────────────────────────────────────────────────── */
  if (job.status !== 'complete' || !job.report) {
    // Progress is private. A shared link to a job that has not finished shows
    // nothing, because the person holding it was given a report, not a window
    // into someone's account activity.
    if (!isOwner) notFound();

    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-[1240px] px-5 md:px-8">
          <ProcessingScreen
            publicId={job.publicId}
            initialStage={job.stage}
            subject={job.subjectName}
            packageName={pkg.name}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  /* ── Complete ──────────────────────────────────────────────────────── */
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ReportView
          packageId={job.packageId}
          report={job.report as Record<string, unknown>}
          sources={job.sources as StoredSource[]}
          meta={job.meta}
          publicId={job.publicId}
          subject={job.subjectName}
          completedAt={job.completedAt ?? job.createdAt}
          isOwner={isOwner}
          cached={Boolean(job.cachedFromJobId)}
        />
      </main>
      <SiteFooter />
    </>
  );
}
