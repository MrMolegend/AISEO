import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { OwnerToolbar } from '@/components/dossier/owner-toolbar';
import { EvidenceExplorer } from '@/components/dossier/evidence-explorer';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { countryName } from '@/config/markets';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { buildEvidenceIndex } from '@/lib/market-entry/evidence-index';
import { marketEntryReportSchema } from '@/schemas/market-entry/report';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Evidence explorer'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * The evidence behind one report, as a first-class surface.
 *
 * Owner-only, like the rest of the workspace. Reports stored before the
 * runner learned to fill `supports` get it recomputed here from their own
 * claims — same function, same result, so both eras index identically.
 */
export default async function EvidencePage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(`/research/${publicId}/evidence`));

  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, user.id);
  if (!job || job.status !== 'complete' || job.packageId !== 'market-entry') notFound();

  const parsed = marketEntryReportSchema.safeParse(job.report);
  if (!parsed.success) notFound();
  const report = parsed.data;

  const index = buildEvidenceIndex(report);
  const sources = report.sources.map((source) => ({
    ...source,
    supports:
      source.supports.length > 0
        ? source.supports
        : (index.supports.get(source.ref) ?? []).slice(0, 24),
  }));

  return (
    <>
      <SiteHeader />
      <main id="main">
        <OwnerToolbar publicId={publicId} active="evidence" />

        <div className="mx-auto max-w-[var(--container-content)] px-5 py-10 md:px-8">
          <Meta>Evidence explorer</Meta>
          <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[38px]">
            {report.decision.businessName} — {countryName(report.decision.targetCountry)}:
            the sources.
          </h1>
          <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
            Every source the research consulted, with who published it, how it was
            obtained, and which sections of the report rest on it.
          </p>

          <div className="mt-10">
            <EvidenceExplorer
              sources={sources}
              blocked={report.coverage.blocked}
              competitors={[...index.competitorRefs.entries()].map(([name, refs]) => ({
                name,
                refs,
              }))}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
