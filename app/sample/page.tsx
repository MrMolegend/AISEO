import type { Metadata } from 'next';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ReportShell } from '@/components/audit/report/report-shell';
import { Badge } from '@/components/ui/badge';
import { getFixtureReport, SAMPLE_FIXTURE } from '@/fixtures';

export const metadata: Metadata = {
  title: 'Sample SEO audit report',
  description:
    'A complete example of an AISEO report: overall and category scores, prioritised issues with evidence, an impact-versus-effort view, a phased action plan and a plain statement of limitations.',
  alternates: { canonical: '/sample' },
  // Unlike real audits, the sample is a genuine content asset and is indexed.
  robots: { index: true, follow: true },
};

export default function SamplePage() {
  const report = getFixtureReport(SAMPLE_FIXTURE);

  return (
    <>
      <SiteHeader />
      <main>
        <div className="mx-auto max-w-[1240px] px-5 pt-8 md:px-8">
          <div className="border-brand-line bg-brand-subtle flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3">
            <Badge tone="brand" size="sm">
              Sample
            </Badge>
            <p className="text-ink-muted text-sm">
              An example report for a fictional company, so you can see the full layout
              before running your own.
            </p>
          </div>
        </div>
        <ReportShell report={report} />
      </main>
      <SiteFooter />
    </>
  );
}
