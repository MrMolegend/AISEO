import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { getFixtureReport, SAMPLE_FIXTURE } from '@/fixtures';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/schemas/audit';
import { ratingPresentation } from '@/lib/scoring';
import { ScoreDial } from '@/components/audit/report/score-dial';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/**
 * A genuine slice of a real report, not a mockup.
 *
 * This renders the actual sample audit through the actual report components. If
 * the report changes, this changes with it — which is the whole point. A drawn
 * approximation of a dashboard would be exactly the "fake dashboard" the design
 * direction rules out.
 */
export function ReportPreview() {
  const report = getFixtureReport(SAMPLE_FIXTURE);
  const { analysis } = report;

  return (
    <section className="mx-auto max-w-[1240px] px-5 py-20 md:px-8 md:py-28">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold md:text-4xl">This is the report</h2>
        <p className="text-ink-muted measure mt-4 text-lg leading-relaxed">
          Every audit uses the same layout, so you always know where to look. Below is a
          real section of a real report.
        </p>
      </div>

      <Card raised className="mt-12 overflow-hidden">
        {/* Header strip */}
        <div className="border-line bg-surface-subtle flex flex-col gap-6 border-b p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="min-w-0">
            <Badge tone="neutral" size="sm">
              Sample audit
            </Badge>
            <h3 className="mt-3 truncate text-xl font-semibold md:text-2xl">
              {analysis.website.name}
            </h3>
            <p className="text-ink-subtle font-mono text-sm">{report.domain}</p>
            <p className="text-ink-muted measure mt-4 text-[15px] leading-relaxed">
              {analysis.executiveSummary.headline}
            </p>
          </div>
          <ScoreDial score={report.overallScore} size={148} animate={false} />
        </div>

        {/* Category strip */}
        <div className="grid grid-cols-2 gap-px bg-[var(--color-line)] md:grid-cols-3">
          {CATEGORY_ORDER.map((category) => {
            const entry = analysis.categoryScores[category];
            const { color, label } = ratingPresentation(entry.score);
            return (
              <div key={category} className="bg-surface p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-muted text-[13px] font-medium">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="tabular text-lg font-semibold" style={{ color }}>
                    {entry.score}
                  </span>
                </div>
                <div className="bg-surface-sunken mt-2.5 h-1.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${entry.score}%`, backgroundColor: color }}
                  />
                </div>
                <p className="text-ink-faint mt-2 text-xs">{label}</p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-8 flex justify-center">
        <Link
          href="/sample"
          className="text-brand inline-flex items-center gap-1.5 text-[15px] font-medium underline-offset-4 hover:underline"
        >
          Read the full sample report
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
