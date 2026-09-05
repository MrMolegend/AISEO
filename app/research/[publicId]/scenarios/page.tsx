import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { OwnerToolbar } from '@/components/dossier/owner-toolbar';
import { ScenarioLab } from '@/components/dossier/scenario-lab';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { countryName } from '@/config/markets';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getReportScenarioStore } from '@/lib/scenarios/store';
import {
  scenarioBaseFrom,
  defaultAssumptionsFrom,
} from '@/lib/market-entry/scenario-lab';
import { storedMarketEntryInputSchema } from '@/schemas/market-entry/input';
import { marketEntryReportSchema } from '@/schemas/market-entry/report';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Scenario Lab'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * The Scenario Lab for one report. Owner-only: what-if work is workspace, not
 * document, and never part of a shared view.
 */
export default async function ScenarioLabPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(`/research/${publicId}/scenarios`));

  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, user.id);
  if (!job || job.status !== 'complete' || job.packageId !== 'market-entry') notFound();

  const input = storedMarketEntryInputSchema.safeParse(job.input);
  const report = marketEntryReportSchema.safeParse(job.report);
  if (!input.success || !report.success) notFound();

  const base = scenarioBaseFrom(input.data, report.data);
  const saved = await (await getReportScenarioStore()).listForJob(user.id, job.id);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <OwnerToolbar publicId={publicId} active="scenarios" />

        <div className="mx-auto max-w-[var(--container-page)] px-5 py-10 md:px-8">
          <Meta>Scenario Lab</Meta>
          <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[38px]">
            {report.data.decision.businessName} —{' '}
            {countryName(report.data.decision.targetCountry)}, on your numbers.
          </h1>
          <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
            Prices and costs start from your brief; demand, conversion and channel mix are
            yours to set. Every figure shows the arithmetic that produced it.
          </p>

          <div className="mt-10">
            <ScenarioLab
              publicId={publicId}
              base={base}
              initialAssumptions={defaultAssumptionsFrom(base)}
              initialSaved={saved.map((scenario) => ({
                id: scenario.id,
                name: scenario.name,
                assumptions: scenario.assumptions,
              }))}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
