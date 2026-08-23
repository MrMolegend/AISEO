import type { AuditReport } from '@/schemas/audit';
import { ScoreDial } from './score-dial';
import { SiteFavicon } from './site-favicon';
import { formatAuditDate } from '@/lib/utils';

/**
 * Report identity block.
 *
 * The favicon is loaded from the audited domain, so it is the one place in the
 * report where a third-party resource is fetched. It fails to a neutral globe
 * mark rather than a broken image.
 */
export function ReportHeader({ report }: { report: AuditReport }) {
  const { analysis, facts } = report;

  return (
    <header className="border-line border-b pb-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-12">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <SiteFavicon src={facts.faviconUrl} />
            <span className="text-ink-subtle truncate font-mono text-sm">
              {report.domain}
            </span>
          </div>

          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {analysis.website.name}
          </h1>

          <p className="text-ink-subtle mt-2 text-sm">
            {analysis.website.industry} · Audited {formatAuditDate(report.createdAt)}
          </p>

          <p className="text-ink measure mt-6 text-lg leading-relaxed">
            {analysis.executiveSummary.headline}
          </p>
        </div>

        {/* Score leads on mobile by stacking above the fold at a smaller size. */}
        <div className="order-first flex justify-center md:order-none md:justify-end">
          <ScoreDial score={report.overallScore} size={120} className="md:hidden" />
          <ScoreDial score={report.overallScore} size={190} className="hidden md:flex" />
        </div>
      </div>
    </header>
  );
}
