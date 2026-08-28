import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SourceList } from './citation';
import { ClaimList, LimitationsPanel, ConflictsPanel } from './claim';
import {
  BusinessProfileSection,
  CompetitorSection,
  LeadCard,
  CreatorCard,
  ActionList,
} from './sections';
import { FilterableList, type FilterableItem } from './filterable-list';
import { availableExports } from '@/lib/export/reports';
import { getPackage, type ResearchPackageId } from '@/config/packages';
import { BRAND } from '@/config/brand';
import type {
  EvidencedClaim,
  ReportMeta,
  ResearchAction,
  StoredSource,
} from '@/schemas/research/shared';
import type { Competitor, CompanyLead, Creator } from '@/schemas/research/packages';

/**
 * The report.
 *
 * A Server Component that reads a validated report object and renders fixed
 * components. The model produced data; this file decides how it looks — which
 * is the rule the whole architecture is built on. Nothing here interpolates
 * model output into markup, and `dangerouslySetInnerHTML` is banned repo-wide by
 * lint, so a report cannot become an XSS vector no matter what a crawled page
 * contained.
 *
 * The layout is one column with a sticky contents list above `xl`. Report prose
 * is capped at a readable measure rather than stretched across a wide screen.
 */

/** Whatever shape the package produced, read defensively. */
type AnyReport = Record<string, unknown>;

export function ReportView({
  packageId,
  report,
  sources,
  meta,
  publicId,
  subject,
  completedAt,
  isOwner,
  cached,
}: {
  packageId: ResearchPackageId;
  report: AnyReport;
  sources: readonly StoredSource[];
  meta: ReportMeta | null;
  publicId: string;
  subject: string;
  completedAt: string;
  isOwner: boolean;
  cached: boolean;
}) {
  const pkg = getPackage(packageId);

  const competitors = (report.competitors as Competitor[] | undefined) ?? [];
  const leads = (report.leads as CompanyLead[] | undefined) ?? [];
  const creators = (report.creators as Creator[] | undefined) ?? [];
  const exports = availableExports(report);

  const sections = [
    { id: 'summary', label: 'Summary', present: true },
    { id: 'business', label: 'Your business', present: Boolean(report.business) },
    { id: 'competitors', label: 'Competitors', present: competitors.length > 0 },
    {
      id: 'customers',
      label: 'Ideal customers',
      present: Boolean(report.idealCustomerProfile),
    },
    { id: 'leads', label: 'Leads', present: leads.length > 0 },
    { id: 'creators', label: 'Creators', present: creators.length > 0 },
    { id: 'recommendations', label: 'Recommendations', present: true },
    {
      id: 'plan',
      label: 'Action plan',
      present: Boolean(report.ninetyDayPlan) || Boolean(report.nextActions),
    },
    { id: 'limitations', label: 'Limitations', present: true },
    { id: 'sources', label: 'Sources', present: sources.length > 0 },
  ].filter((section) => section.present);

  return (
    <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-10 md:px-8 xl:grid-cols-[220px_minmax(0,1fr)]">
      {/* ── Contents ────────────────────────────────────────────────────── */}
      <nav
        aria-label="Report contents"
        className="hidden xl:sticky xl:top-24 xl:block xl:self-start print:hidden"
      >
        <p className="text-text-subtle mb-3 text-xs font-medium tracking-wide uppercase">
          Contents
        </p>
        <ul className="space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-text-muted hover:bg-ground-sunken hover:text-text focus-visible:ring-cobalt block rounded-[var(--radius-control)] px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" size="sm">
              {pkg.name}
            </Badge>
            {cached && (
              <Badge tone="brand" size="sm">
                Cached result — not charged
              </Badge>
            )}
          </div>

          <h1 className="text-text mt-3 text-[32px] leading-tight font-semibold tracking-[var(--tracking-display)]">
            {subject}
          </h1>

          <p className="text-text-subtle mt-2 text-sm">
            Generated{' '}
            <time dateTime={completedAt}>
              {new Date(completedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
            {meta && (
              <span className="tabular-nums">
                {' '}
                · {meta.sourceCount} sources · {meta.pagesRead} pages read
              </span>
            )}
          </p>

          {/* The disclaimer is above the fold rather than buried in a footer.
              It changes how the whole page should be read. */}
          <p className="border-rule bg-ground-raised text-text-muted mt-5 rounded-[var(--radius-control)] border px-4 py-3 text-sm leading-relaxed">
            Built entirely from public web sources. Every factual claim links to where we
            found it — follow the numbered references to check anything before you act on
            it. Nothing here is confidential or non-public information.
          </p>

          {(exports.length > 0 || isOwner) && (
            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              {exports.map((kind) => (
                <a
                  key={kind}
                  href={`/api/research/${publicId}/export?kind=${kind}`}
                  className="border-rule-strong bg-ground-raised text-text hover:bg-ground-raised focus-visible:ring-cobalt inline-flex h-10 items-center rounded-[var(--radius-control)] border px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  Download {kind} CSV
                </a>
              ))}
            </div>
          )}
        </header>

        <div className="mt-10 space-y-12">
          {/* ── Summary ─────────────────────────────────────────────────── */}
          <Section id="summary" title="Summary">
            {typeof report.headline === 'string' && (
              <p className="text-text max-w-[68ch] text-lg leading-relaxed font-medium">
                {report.headline}
              </p>
            )}
            {typeof report.executiveSummary === 'string' && (
              <p className="text-text-muted mt-4 max-w-[68ch] leading-relaxed">
                {report.executiveSummary}
              </p>
            )}
            {typeof report.marketOverview === 'string' && (
              <p className="text-text-muted mt-4 max-w-[68ch] leading-relaxed">
                {report.marketOverview}
              </p>
            )}
          </Section>

          {/* ── Business ────────────────────────────────────────────────── */}
          {report.business != null && (
            <Section id="business" title="Your business, as the web describes it">
              <BusinessProfileSection
                business={report.business as never}
                sources={sources}
              />
            </Section>
          )}

          {/* ── Competitors ─────────────────────────────────────────────── */}
          {competitors.length > 0 && (
            <Section id="competitors" title={`Competitors (${competitors.length})`}>
              <CompetitorSection competitors={competitors} sources={sources} />
            </Section>
          )}

          {/* ── Ideal customers ─────────────────────────────────────────── */}
          {report.idealCustomerProfile != null && (
            <Section id="customers" title="Ideal customers">
              <IdealCustomer report={report} />
            </Section>
          )}

          {/* ── Leads ───────────────────────────────────────────────────── */}
          {leads.length > 0 && (
            <Section id="leads" title={`Leads (${leads.length})`}>
              <FilterableList
                itemNoun="leads"
                items={leads.map((lead): FilterableItem => ({
                  id: lead.id,
                  rank: lead.rank,
                  score: lead.fitScore,
                  searchText: [
                    lead.name,
                    lead.industry,
                    lead.location,
                    lead.publicDescription,
                  ].join(' '),
                  node: <LeadCard lead={lead} sources={sources} />,
                }))}
              />
            </Section>
          )}

          {/* ── Creators ────────────────────────────────────────────────── */}
          {creators.length > 0 && (
            <Section id="creators" title={`Creators (${creators.length})`}>
              <FilterableList
                itemNoun="creators"
                items={creators.map((creator): FilterableItem => ({
                  id: creator.id,
                  rank: creator.rank,
                  score: creator.brandFitScore,
                  searchText: [
                    creator.name,
                    creator.niche,
                    creator.platform,
                    creator.audienceFit,
                  ].join(' '),
                  node: <CreatorCard creator={creator} sources={sources} />,
                }))}
              />
            </Section>
          )}

          {/* ── Recommendations ─────────────────────────────────────────── */}
          <Section id="recommendations" title="Recommendations">
            <div className="space-y-6">
              {typeof report.recommendedPositioning === 'string' && (
                <Card>
                  <CardBody>
                    <h3 className="text-text text-base font-semibold">Positioning</h3>
                    <p className="text-text-muted mt-2 max-w-[68ch] leading-relaxed">
                      {report.recommendedPositioning}
                    </p>
                  </CardBody>
                </Card>
              )}

              {typeof report.recommendedOffer === 'string' && (
                <Card>
                  <CardBody>
                    <h3 className="text-text text-base font-semibold">Offer</h3>
                    <p className="text-text-muted mt-2 max-w-[68ch] leading-relaxed">
                      {report.recommendedOffer}
                    </p>
                  </CardBody>
                </Card>
              )}

              <ClaimGroupCard
                title="Opportunity gaps"
                claims={report.opportunityGaps as never}
                sources={sources}
              />
              <ClaimGroupCard
                title="Marketing opportunities"
                claims={report.marketingOpportunities as never}
                sources={sources}
              />
              <ClaimGroupCard
                title="Risks"
                claims={report.risks as never}
                sources={sources}
              />
              <AcquisitionChannels report={report} />
            </div>
          </Section>

          {/* ── Plan ────────────────────────────────────────────────────── */}
          <Section id="plan" title="What to do next">
            <PlanSection report={report} />
          </Section>

          {/* ── Limitations ─────────────────────────────────────────────── */}
          <Section id="limitations" title="Limitations">
            <div className="space-y-4">
              <LimitationsPanel limitations={(report.limitations as never) ?? []} />
              <ConflictsPanel
                conflicts={(report.conflicts as never) ?? []}
                sources={sources}
              />
            </div>
          </Section>

          {/* ── Sources ─────────────────────────────────────────────────── */}
          {sources.length > 0 && (
            <Section id="sources" title={`Sources (${sources.length})`}>
              <Card>
                <CardBody>
                  <SourceList sources={sources} />
                </CardBody>
              </Card>
            </Section>
          )}

          {/* ── Provenance ──────────────────────────────────────────────── */}
          {meta && (
            <footer className="border-rule border-t pt-6">
              <p className="text-text-faint text-xs leading-relaxed tabular-nums">
                {pkg.name} · {meta.searchQueries} searches · {meta.pagesRead} pages ·{' '}
                {meta.sourceCount} sources · prompt {meta.promptVersion} ·{' '}
                {Math.round(meta.durationMs / 1000)}s
                {meta.repairAttempts > 0 && ` · ${meta.repairAttempts} correction pass`}
              </p>
              <p className="text-text-faint mt-2 text-xs leading-relaxed">
                {BRAND.currency.disclaimer}
              </p>
              {isOwner && (
                <Link
                  href="/dashboard"
                  className="text-cobalt hover:text-cobalt focus-visible:ring-cobalt mt-4 inline-block rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none print:hidden"
                >
                  Back to your dashboard
                </Link>
              )}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2
        id={`${id}-heading`}
        className="text-text mb-5 text-[22px] font-semibold tracking-[var(--tracking-tight)]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ClaimGroupCard({
  title,
  claims,
  sources,
}: {
  title: string;
  claims: readonly EvidencedClaim[] | undefined;
  sources: readonly StoredSource[];
}) {
  if (!claims || claims.length === 0) return null;
  return (
    <Card>
      <CardBody>
        <h3 className="text-text text-base font-semibold">{title}</h3>
        <ClaimList claims={claims} sources={sources} className="mt-3 space-y-4" />
      </CardBody>
    </Card>
  );
}

function IdealCustomer({ report }: { report: AnyReport }) {
  const icp = report.idealCustomerProfile as
    | {
        description: string;
        companySize: string;
        geography: string;
        buyingTrigger: string;
        disqualifiers: string[];
      }
    | undefined;
  if (!icp) return null;

  const segments =
    (report.primarySegments as
      | Array<{
          name: string;
          description: string;
          whyTheyBuy: string;
          whereToFindThem: string;
        }>
      | undefined) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <p className="text-text-muted max-w-[68ch] leading-relaxed">
            {icp.description}
          </p>

          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-text-subtle text-xs font-medium tracking-wide uppercase">
                Size
              </dt>
              <dd className="text-text-muted mt-1 text-sm">{icp.companySize || '—'}</dd>
            </div>
            <div>
              <dt className="text-text-subtle text-xs font-medium tracking-wide uppercase">
                Geography
              </dt>
              <dd className="text-text-muted mt-1 text-sm">{icp.geography || '—'}</dd>
            </div>
            <div>
              <dt className="text-text-subtle text-xs font-medium tracking-wide uppercase">
                Buying trigger
              </dt>
              <dd className="text-text-muted mt-1 text-sm">{icp.buyingTrigger || '—'}</dd>
            </div>
          </dl>

          {icp.disqualifiers.length > 0 && (
            <div className="border-rule mt-5 border-t pt-5">
              <h3 className="text-text-subtle text-xs font-medium tracking-wide uppercase">
                Not a fit
              </h3>
              <ul className="mt-2 space-y-1">
                {icp.disqualifiers.map((item) => (
                  <li key={item} className="text-text-muted text-sm leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      {segments.map((segment) => (
        <Card key={segment.name}>
          <CardBody>
            <h3 className="text-text text-base font-semibold">{segment.name}</h3>
            <p className="text-text-muted mt-2 text-sm leading-relaxed">
              {segment.description}
            </p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-text-subtle text-xs font-medium tracking-wide uppercase">
                  Why they buy
                </dt>
                <dd className="text-text-muted mt-1 text-sm leading-relaxed">
                  {segment.whyTheyBuy}
                </dd>
              </div>
              <div>
                <dt className="text-text-subtle text-xs font-medium tracking-wide uppercase">
                  Where to find them
                </dt>
                <dd className="text-text-muted mt-1 text-sm leading-relaxed">
                  {segment.whereToFindThem}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function AcquisitionChannels({ report }: { report: AnyReport }) {
  const channels = report.acquisitionChannels as
    | Array<{ channel: string; rationale: string; effort: string; confidence: string }>
    | undefined;
  if (!channels || channels.length === 0) return null;

  return (
    <Card>
      <CardBody>
        <h3 className="text-text text-base font-semibold">Acquisition channels</h3>
        <ul className="mt-3 space-y-4">
          {channels.map((channel) => (
            <li key={channel.channel}>
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-text text-sm font-medium">{channel.channel}</h4>
                <Badge tone="neutral" size="sm">
                  {channel.effort} effort
                </Badge>
              </div>
              <p className="text-text-muted mt-1 text-sm leading-relaxed">
                {channel.rationale}
              </p>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

const PHASE_LABEL: Record<string, string> = {
  'days-1-30': 'Days 1–30',
  'days-31-60': 'Days 31–60',
  'days-61-90': 'Days 61–90',
};

function PlanSection({ report }: { report: AnyReport }) {
  const plan = report.ninetyDayPlan as
    | Array<{
        phase: string;
        focus: string;
        actions: readonly ResearchAction[];
      }>
    | undefined;

  const firstTen = report.firstTenActions as readonly ResearchAction[] | undefined;

  const nextActions = report.nextActions as readonly ResearchAction[] | undefined;

  return (
    <div className="space-y-8">
      {firstTen && firstTen.length > 0 && (
        <div>
          <h3 className="text-text mb-3 text-base font-semibold">Start with these</h3>
          <ActionList actions={firstTen} />
        </div>
      )}

      {nextActions && nextActions.length > 0 && (
        <div>
          <h3 className="text-text mb-3 text-base font-semibold">Next actions</h3>
          <ActionList actions={nextActions} />
        </div>
      )}

      {plan?.map((phase) => (
        <div key={phase.phase}>
          <h3 className="text-text text-base font-semibold">
            {PHASE_LABEL[phase.phase] ?? phase.phase}
          </h3>
          <p className="text-text-muted mt-1 mb-3 text-sm leading-relaxed">
            {phase.focus}
          </p>
          <ActionList actions={phase.actions} />
        </div>
      ))}
    </div>
  );
}
