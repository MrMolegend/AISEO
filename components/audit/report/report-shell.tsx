import type { AuditReport } from '@/schemas/audit';
import { ReportNav, type ReportSection } from './report-nav';
import { ReportHeader } from './report-header';
import { CategoryScoreGrid } from './category-score-grid';
import { ExecutiveSummary } from './executive-summary';
import { IssueSection } from './issue-section';
import { TopPriorities } from './top-priorities';
import { ImpactEffortMatrix } from './impact-effort-matrix';
import { ActionPlan } from './action-plan';
import { OpportunityGrid } from './opportunity-grid';
import { StrengthsList } from './strengths-list';
import { LimitationsPanel } from './limitations-panel';

const SECTIONS: ReportSection[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'scores', label: 'Scores' },
  { id: 'priorities', label: 'Priorities' },
  { id: 'issues', label: 'Issues' },
  { id: 'opportunities', label: 'Opportunities' },
  { id: 'plan', label: 'Action plan' },
  { id: 'limitations', label: 'Limitations' },
];

/**
 * The fixed report layout.
 *
 * Every audit renders through this component in this order, which is what makes
 * a report recognisable rather than a surprise each time. The AI supplies data
 * for these slots and nothing else — it never decides what the page looks like.
 */
export function ReportShell({
  report,
  footer,
}: {
  report: AuditReport;
  footer?: React.ReactNode;
}) {
  const { analysis } = report;

  return (
    <div className="mx-auto max-w-[1240px] px-5 md:px-8">
      <div className="xl:flex xl:gap-12">
        <div className="hidden xl:block xl:w-[200px] xl:shrink-0 xl:pt-10">
          <ReportNav sections={SECTIONS} />
        </div>

        <div className="min-w-0 flex-1 pt-6 pb-20 xl:max-w-[880px] xl:pt-10">
          <ReportHeader report={report} />

          <div className="xl:hidden">
            <ReportNav sections={SECTIONS} />
          </div>

          <Section id="overview" title="Executive summary">
            <ExecutiveSummary analysis={analysis} />
          </Section>

          <Section id="scores" title="Category scores">
            <CategoryScoreGrid analysis={analysis} />
            <div className="mt-10">
              <h3 className="text-lg font-semibold">What is working well</h3>
              <div className="mt-4">
                <StrengthsList analysis={analysis} />
              </div>
            </div>
          </Section>

          <Section
            id="priorities"
            title="Top priorities"
            lede="If you only do a few things, do these — ranked by what they return for what they cost."
          >
            <TopPriorities analysis={analysis} />
            <div className="mt-10">
              <h3 className="text-lg font-semibold">Impact against effort</h3>
              <p className="text-ink-muted measure mt-1.5 text-sm leading-relaxed">
                Every issue plotted by how much it should return and how much work it
                takes.
              </p>
              <div className="mt-5">
                <ImpactEffortMatrix issues={analysis.issues} />
              </div>
            </div>
          </Section>

          <Section
            id="issues"
            title="Everything we found"
            lede="Filter by severity or area. Each issue expands to show what was found, why it matters and what to do."
          >
            <IssueSection issues={analysis.issues} />
          </Section>

          <Section
            id="opportunities"
            title="Opportunities"
            lede="Not defects — things this site could do that it currently does not."
          >
            <OpportunityGrid analysis={analysis} />
          </Section>

          <Section
            id="plan"
            title="Action plan"
            lede="The same findings, sequenced into what to do now, this month and this quarter."
          >
            <ActionPlan analysis={analysis} />
          </Section>

          <Section id="limitations" title="What this audit could not determine">
            <LimitationsPanel analysis={analysis} />
          </Section>

          {footer}
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  lede,
  children,
}: {
  id: string;
  title: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-40 pt-14 xl:scroll-mt-24">
      <h2 className="text-2xl font-semibold md:text-[1.75rem]">{title}</h2>
      {lede ? (
        <p className="text-ink-muted measure mt-2 text-[15px] leading-relaxed">{lede}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}
