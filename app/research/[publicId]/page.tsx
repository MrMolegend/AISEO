import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { DossierView } from '@/components/dossier/dossier-view';
import { VersionRail, type VersionEntry } from '@/components/dossier/version-rail';
import { OwnerToolbar } from '@/components/dossier/owner-toolbar';
import { ProcessingScreen } from '@/components/research/processing-screen';
import { ReportView } from '@/components/research/report/report-view';
import { Button } from '@/components/ui/button';
import { Panel, Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { isResearchPackageId } from '@/config/packages';
import { renderErrorCopy } from '@/lib/errors';
import { getCurrentUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { reportKindLabel, isLegacyReport } from '@/lib/jobs/labels';
import { isTerminal } from '@/lib/jobs/stages';
import { marketEntryReportSchema } from '@/schemas/market-entry/report';
import type { StoredSource } from '@/schemas/research/shared';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Report'),
  // Reports concern real businesses and carry the customer's own brief. They
  // are shared by capability link, not published.
  robots: { index: false, follow: false },
};

/**
 * One URL, two eras of report.
 *
 * Reports produced by the previous product are still readable at the addresses
 * they were shared with — that is what "legacy reports remain readable" has to
 * mean in practice, and it is why this page dispatches on the stored package id
 * rather than the new product having its own route. Nothing anyone has already
 * sent to a colleague stops working.
 */
export default async function ReportPage({
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
  const kindLabel = reportKindLabel(job.packageId);

  /* ── Failed ──────────────────────────────────────────────────────────── */
  if (job.status === 'failed' || job.status === 'cancelled') {
    if (!isOwner) notFound();

    const code = job.errorCode ?? 'UNKNOWN';
    const copy = renderErrorCopy(code, job.subjectName);
    const refunded = code === 'INSUFFICIENT_MARKET_EVIDENCE';

    return (
      <>
        <SiteHeader />
        <main
          id="main"
          className="mx-auto max-w-[var(--container-narrow)] px-5 py-16 md:px-8"
        >
          <Meta>{kindLabel}</Meta>
          <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[36px]">
            {copy.title}
          </h1>
          <p className="text-text-muted mt-4 text-[15px] leading-relaxed">{copy.body}</p>

          {/*
           * The credit, said plainly and immediately.
           *
           * Someone whose report did not arrive is asking two questions, and
           * the second one is "have I been charged". Answering it below the
           * fold, or only in a ledger they have to go and find, is how a
           * refunded customer still writes to support.
           */}
          {refunded && (
            <Panel edge="signal" className="mt-8">
              <div className="p-5">
                <p className="text-text text-[15px] leading-relaxed">
                  <strong className="font-medium">
                    Your {BRAND.credit.singular} has been returned.
                  </strong>{' '}
                  You were not charged for this assessment. Nothing further is needed from
                  you.
                </p>
              </div>
            </Panel>
          )}

          {refunded && (
            <div className="mt-8">
              <Meta>What usually helps</Meta>
              <ul className="text-text-muted mt-3 space-y-2 text-[14px] leading-relaxed">
                <li className="border-rule border-l-2 pl-3">
                  Describe the product more specifically. The research is built from that
                  description, and a broader one finds broader sources.
                </li>
                <li className="border-rule border-l-2 pl-3">
                  Widen the target market from a city to the country, or narrow it from a
                  region to a single country.
                </li>
                <li className="border-rule border-l-2 pl-3">
                  Thinly documented categories produce thin evidence. If the public record
                  is quiet on this product, no amount of searching will change that.
                </li>
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-wrap gap-3">
            {copy.retryable && (
              <Button asChild>
                <Link href={`/assess?from=${job.publicId}`}>Edit and try again</Link>
              </Button>
            )}
            <Button asChild variant="secondary">
              <Link href="/assess">Start a new assessment</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard">Back to the desk</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  /* ── Still running ───────────────────────────────────────────────────── */
  if (!isTerminal(job.status) || !job.report) {
    // A job in flight is not a capability anyone else holds: an unfinished
    // report is not a report, and a public id should not leak the existence of
    // one into someone's account activity.
    if (!isOwner) notFound();

    return (
      <>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-[var(--container-page)] px-5 md:px-8">
          <ProcessingScreen
            publicId={job.publicId}
            initialStage={job.stage}
            subject={job.subjectName}
            packageName={kindLabel}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  /* ── Complete: the current product ───────────────────────────────────── */
  if (!isLegacyReport(job.packageId)) {
    const parsed = marketEntryReportSchema.safeParse(job.report);
    if (!parsed.success) notFound();

    /*
     * The version rail: this profile's other runs, owner-only.
     *
     * Loaded here rather than inside the dossier so the document component
     * stays a pure renderer of one report. A report with no profile, or a
     * profile with one run, renders no rail at all.
     */
    let versions: VersionEntry[] = [];
    let profileName: string | null = null;

    if (isOwner && user && job.profileId) {
      const { versionsFrom } = await import('@/lib/lineage/versions');
      const siblings = await store.listForProfile(user.id, job.profileId);
      versions = versionsFrom(siblings, job.publicId);

      const { getBusinessProfileStore } = await import('@/lib/profiles/store');
      profileName = await (
        await getBusinessProfileStore()
      )
        .getForUser(job.profileId, user.id)
        .then((profile) => profile?.name ?? null)
        .catch(() => null);
    }

    return (
      <>
        <SiteHeader />
        <main id="main">
          {isOwner && <OwnerToolbar publicId={job.publicId} active="" />}
          <VersionRail versions={versions} profileName={profileName} />
          <DossierView report={parsed.data} publicId={job.publicId} isOwner={isOwner} />
        </main>
        <SiteFooter />
      </>
    );
  }

  /* ── Complete: a report from the previous product ────────────────────── */
  return (
    <>
      <SiteHeader />
      <main id="main">
        <div className="mx-auto max-w-[var(--container-page)] px-5 pt-8 md:px-8">
          <Panel edge="cobalt">
            <div className="p-4">
              <p className="text-text text-[14px] leading-relaxed">
                <strong className="font-medium">A report from an earlier version.</strong>{' '}
                {BRAND.name} now produces one Market Entry Intelligence Report rather than
                separate research packages. This one is kept exactly as it was written, at
                the address it was shared with.
              </p>
            </div>
          </Panel>
        </div>

        <ReportView
          packageId={
            isResearchPackageId(job.packageId) ? job.packageId : 'competitor-intelligence'
          }
          report={job.report as Record<string, unknown>}
          sources={job.sources as StoredSource[]}
          meta={job.meta}
          publicId={job.publicId}
          subject={job.subjectName}
          completedAt={job.completedAt ?? job.createdAt}
          cached={Boolean(job.cachedFromJobId)}
          isOwner={isOwner}
        />
      </main>
      <SiteFooter />
    </>
  );
}
