import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { CompareView } from '@/components/dossier/compare-view';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { compareReports } from '@/lib/market-entry/compare';
import { marketEntryReportSchema } from '@/schemas/market-entry/report';
import { countryName } from '@/config/markets';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Compare report versions'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * Two versions of a report, compared.
 *
 * Owner-only: comparison is a workspace feature, not part of the shared
 * document. Both reads are owner-filtered, so a public id belonging to anyone
 * else — in either position — is a 404, and the two reports must be
 * market-entry dossiers; there is no meaningful diff across product eras.
 *
 * The earlier version is always "before", whichever order the URL names them
 * in — a comparison that flips sign depending on the link you clicked is
 * worse than none.
 */
export default async function ComparePage({
  params,
}: {
  params: Promise<{ publicId: string; otherId: string }>;
}) {
  const { publicId, otherId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(`/research/${publicId}/compare/${otherId}`));
  if (publicId === otherId) notFound();

  const store = await getResearchJobStore();
  const [a, b] = await Promise.all([
    store.getForUser(publicId, user.id),
    store.getForUser(otherId, user.id),
  ]);
  if (!a || !b || a.status !== 'complete' || b.status !== 'complete') notFound();

  const parsedA = marketEntryReportSchema.safeParse(a.report);
  const parsedB = marketEntryReportSchema.safeParse(b.report);
  if (!parsedA.success || !parsedB.success) notFound();

  const [earlier, later] =
    a.createdAt <= b.createdAt
      ? ([
          { job: a, report: parsedA.data },
          { job: b, report: parsedB.data },
        ] as const)
      : ([
          { job: b, report: parsedB.data },
          { job: a, report: parsedA.data },
        ] as const);

  const comparison = compareReports(earlier.report, later.report);

  const label = (job: typeof a) =>
    `${new Date(job.createdAt).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="mx-auto max-w-[var(--container-content)] px-5 pt-10 md:px-8">
          <Meta>Version comparison</Meta>
          <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[38px]">
            {later.report.decision.businessName} —{' '}
            {countryName(later.report.decision.targetCountry)}
          </h1>
          <p className="text-text-muted mt-3 text-[15px] leading-relaxed">
            {label(earlier.job)} compared with {label(later.job)}. The earlier run is
            always the baseline.
          </p>
          <p className="mt-4 text-[13px]">
            <Link
              href={`/research/${later.job.publicId}`}
              className="text-cobalt underline-offset-4 hover:underline"
            >
              Open the newer report
            </Link>
            <span className="text-text-faint"> · </span>
            <Link
              href={`/research/${earlier.job.publicId}`}
              className="text-cobalt underline-offset-4 hover:underline"
            >
              Open the earlier report
            </Link>
          </p>
        </div>

        <CompareView
          comparison={comparison}
          beforeLabel={`the ${label(earlier.job)} run`}
          afterLabel={`the ${label(later.job)} run`}
        />
      </main>
      <SiteFooter />
    </>
  );
}
