import { Panel, Rule, Meta } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { BRAND } from '@/config/brand';
import { countryName } from '@/config/markets';
import { REPORT_SECTIONS, type MarketEntryReport } from '@/schemas/market-entry/report';
import { buildLookup, ClaimList, Value, GradeChip } from './evidence';
import { ContentsNav } from './contents-nav';
import { ShareControls } from './share-controls';
import {
  DecisionHeader,
  RiskMatrix,
  RouteComparison,
  Scenarios,
  Timeline,
  CoveragePanel,
  CompetitorEntry,
} from './panels';

/**
 * The Market Entry Intelligence Report.
 *
 * Twelve sections in a fixed order, on a warm document surface inside an
 * obsidian page — `data-surface="leaf"` re-points the colour tokens so every
 * component inside renders for paper without knowing it is on paper.
 *
 * The structural rule that keeps this readable: no section renders as a grid of
 * cards. A risk register is a matrix plus a register, a route comparison is a
 * table, a plan is a timeline, and evidence lives in drawers under the claims
 * it supports. Twelve card grids would be a scrolling exercise rather than a
 * decision document.
 *
 * Nothing here interpolates model output into markup, and dangerouslySetInnerHTML
 * is banned repo-wide by lint. Report text is rendered as text, always.
 */
export function DossierView({
  report,
  publicId,
  isOwner,
  illustrative = false,
}: {
  report: MarketEntryReport;
  publicId: string | null;
  isOwner: boolean;
  /** Set for the worked example, which is fictional and says so throughout. */
  illustrative?: boolean;
}) {
  const lookup = buildLookup(report.sources, report.grades);
  const { decision } = report;

  return (
    <div
      data-surface="leaf"
      className="mx-auto grid max-w-[var(--container-page)] gap-10 px-5 py-8 md:px-8 xl:grid-cols-[190px_minmax(0,1fr)] xl:gap-14"
    >
      <ContentsNav />

      <div className="min-w-0">
        {illustrative && (
          <div
            className="border-cobalt-line bg-cobalt-surface mb-8 border-l-[3px] p-4"
            role="note"
          >
            <p className="text-text text-[14px] leading-relaxed">
              <strong className="font-medium">Illustrative example.</strong> Ardmore Sea
              Salt is a fictional business and every source below is a demonstration
              address that does not resolve. The structure, the scoring and the evidence
              labelling are exactly what a real assessment produces.
            </p>
          </div>
        )}

        <Section id="decision" hideHeading label="Decision">
          <DecisionHeader report={report} />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Meta>
              {BRAND.defaultReportTitle}
              {publicId ? ` · ${publicId}` : ''}
            </Meta>
            <ShareControls
              shareable={isOwner && publicId !== null}
              sourcesHref={
                publicId ? `/api/research/${publicId}/export?kind=sources` : null
              }
            />
          </div>
        </Section>

        <Section id="executive" label="Executive verdict">
          <p className="text-text measure text-[16px] leading-relaxed">
            {report.executive.summary}
          </p>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <Finding
              label="Is the market attractive?"
              claim={report.executive.attractiveness}
              path="executive.attractiveness"
              lookup={lookup}
            />
            <Finding
              label="Strongest opportunity"
              claim={report.executive.strongestOpportunity}
              path="executive.strongestOpportunity"
              lookup={lookup}
            />
            <Finding
              label="Largest obstacle"
              claim={report.executive.largestObstacle}
              path="executive.largestObstacle"
              lookup={lookup}
            />
            <div>
              <Rule label="Recommended next decision" />
              <p className="text-text measure mt-3 text-[15px] leading-relaxed">
                {report.executive.recommendedNextDecision}
              </p>
            </div>
          </div>
        </Section>

        <Section id="context" label="Commercial context">
          <dl className="grid gap-6 md:grid-cols-2">
            <Field label="The offer" value={report.commercialContext.offerSummary} />
            <Field
              label="Where you are"
              value={report.commercialContext.currentSituation}
            />
            <Field
              label="Route preference"
              value={report.commercialContext.routePreferenceNote}
            />
            <div>
              <Meta>Markets</Meta>
              <p className="text-text mt-1 text-[15px]">
                {countryName(decision.originCountry)} →{' '}
                {countryName(decision.targetCountry)}
                {decision.targetRegion ? ` · ${decision.targetRegion}` : ''}
              </p>
            </div>
          </dl>

          {report.commercialContext.assumptions.length > 0 && (
            <div className="mt-8">
              <Rule label="Assumptions this report stands on" />
              <ul className="mt-3 space-y-2">
                {report.commercialContext.assumptions.map((assumption) => (
                  <li
                    key={assumption}
                    className="text-text-muted measure border-rule border-l-2 pl-3 text-[14px] leading-relaxed"
                  >
                    {assumption}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section id="signals" label="Market signals">
          <div className="grid gap-8 md:grid-cols-[1fr_260px]">
            <div className="space-y-8">
              <Group label="Demand">
                <ClaimList
                  claims={report.marketSignals.demand}
                  path="marketSignals.demand"
                  lookup={lookup}
                />
              </Group>
              <Group label="Growth or contraction">
                <ClaimList
                  claims={report.marketSignals.growth}
                  path="marketSignals.growth"
                  lookup={lookup}
                />
              </Group>
              <Group label="Customer behaviour">
                <ClaimList
                  claims={report.marketSignals.customerBehaviour}
                  path="marketSignals.customerBehaviour"
                  lookup={lookup}
                />
              </Group>
              <Group label="Trends">
                <ClaimList
                  claims={report.marketSignals.trends}
                  path="marketSignals.trends"
                  lookup={lookup}
                />
              </Group>
            </div>

            <aside className="space-y-6">
              <Panel inset>
                <div className="p-4">
                  <Value
                    value={report.marketSignals.size}
                    path="marketSignals.size"
                    lookup={lookup}
                    label="Market size"
                  />
                </div>
              </Panel>
              <div>
                <Meta>Geographic relevance</Meta>
                <p className="text-text-muted mt-1.5 text-[13px] leading-relaxed">
                  {report.marketSignals.geographicNote}
                </p>
              </div>
            </aside>
          </div>

          {/*
           * Series render only when every point is numeric and sourced, which
           * the validator enforces. A chart is the most authoritative-looking
           * thing on a page and must not be the least evidenced, so when the
           * data cannot support one there is deliberately nothing here.
           */}
          {report.marketSignals.series.length === 0 && (
            <p className="text-text-faint mt-6 text-[13px] leading-relaxed">
              No numerical series was published in a form that could be charted with every
              point sourced, so none is shown.
            </p>
          )}
        </Section>

        <Section id="competitive" label="Competitive landscape">
          <p className="text-text-muted measure text-[14px] leading-relaxed">
            {report.competitive.coverageNote}
          </p>
          <ol className="mt-8 space-y-8">
            {report.competitive.entries.map((entry, index) => (
              <CompetitorEntry
                key={entry.id}
                entry={entry}
                index={index}
                lookup={lookup}
              />
            ))}
          </ol>
        </Section>

        <Section id="customers" label="Customers and buyers">
          <ol className="space-y-10">
            {report.customers.groups.map((group, index) => (
              <li key={group.id} data-print-keep>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    size="sm"
                    tone={group.priority === 'primary' ? 'signal' : 'neutral'}
                  >
                    {group.priority}
                  </Badge>
                  <Meta>confidence {group.confidence}</Meta>
                </div>
                <h3 className="font-display text-text mt-2 text-[22px] leading-tight">
                  {group.name}
                </h3>
                <p className="text-text-muted measure mt-2 text-[14px] leading-relaxed">
                  {group.description}
                </p>

                <div className="mt-5 grid gap-6 md:grid-cols-3">
                  <Group label="Motivations">
                    <ClaimList
                      claims={group.motivations}
                      path={`customers.groups[${index}].motivations`}
                      lookup={lookup}
                    />
                  </Group>
                  <Group label="Purchase criteria">
                    <ClaimList
                      claims={group.purchaseCriteria}
                      path={`customers.groups[${index}].purchaseCriteria`}
                      lookup={lookup}
                    />
                  </Group>
                  <Group label="Objections">
                    <ClaimList
                      claims={group.objections}
                      path={`customers.groups[${index}].objections`}
                      lookup={lookup}
                    />
                  </Group>
                </div>

                <div className="mt-5">
                  <Rule label="Channels that reach them" />
                  <p className="text-text-muted mt-2 text-[14px]">
                    {group.channels.join(' · ')}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <p className="text-text-subtle measure mt-8 text-[13px] leading-relaxed">
            {report.customers.uncertaintyNote}
          </p>
          <p className="text-text-faint mt-2 text-[12px] leading-relaxed">
            This report names categories of buyer and the routes that reach them. It does
            not name individuals and carries no contact details.
          </p>
        </Section>

        <Section id="route" label="Route to market">
          <RouteComparison report={report} lookup={lookup} />
        </Section>

        <Section id="pricing" label="Pricing and margin">
          <Scenarios report={report} />

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <Group label="Researched price benchmarks">
              <ClaimList
                claims={report.pricing.researchedBenchmarks}
                path="pricing.researchedBenchmarks"
                lookup={lookup}
                empty="No comparable price was found in a source we could stand behind."
              />
            </Group>

            <div className="space-y-6">
              <div>
                <Rule label="Suggested positioning" />
                <p className="text-text measure mt-3 text-[15px] leading-relaxed">
                  {report.pricing.suggestedPositioning}
                </p>
              </div>

              {report.pricing.missingData.length > 0 && (
                <div>
                  <Rule label="Missing from this analysis" />
                  <ul className="mt-3 space-y-1.5">
                    {report.pricing.missingData.map((item) => (
                      <li key={item} className="text-text-faint text-[13px]">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {report.pricing.note && (
            <p className="text-text-subtle measure mt-8 text-[13px] leading-relaxed">
              {report.pricing.note}
            </p>
          )}
        </Section>

        <Section id="regulation" label="Regulation and operations">
          <div
            className="border-copper-line bg-copper-surface mb-8 border-l-[3px] p-4"
            role="note"
          >
            <p className="text-text text-[14px] leading-relaxed">
              This is research, not legal or regulatory advice. Everything below is
              reported as the named authority publishes it. Confirm anything you are about
              to spend money against with that authority, or with a qualified adviser,
              first.
            </p>
          </div>

          <ol className="space-y-8">
            {report.regulation.requirements.map((requirement, index) => (
              <li key={requirement.id} data-print-keep>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge size="sm">{requirement.area.replace(/-/g, ' ')}</Badge>
                  <Meta>confidence {requirement.confidence}</Meta>
                </div>
                <h3 className="text-text mt-2 text-[17px] font-medium">
                  {requirement.title}
                </h3>
                <p className="text-text-muted measure mt-2 text-[14px] leading-relaxed">
                  {requirement.detail}
                </p>
                <p className="text-text measure mt-3 text-[14px]">
                  <span className="meta text-text-faint mr-2">Verify with</span>
                  {requirement.verifyWith}
                </p>
                <ClaimList
                  claims={requirement.evidence}
                  path={`regulation.requirements[${index}].evidence`}
                  lookup={lookup}
                />
              </li>
            ))}
          </ol>

          {report.regulation.gaps.length > 0 && (
            <div className="mt-10">
              <Rule label="Not established" />
              <ul className="mt-3 space-y-2">
                {report.regulation.gaps.map((gap) => (
                  <li
                    key={gap}
                    className="text-text-muted measure border-copper-line border-l-2 pl-3 text-[14px] leading-relaxed"
                  >
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section id="risks" label="Risk register">
          <RiskMatrix report={report} lookup={lookup} />
        </Section>

        <Section id="plan" label="30/60/90-day plan">
          <Timeline report={report} />
        </Section>

        <Section id="appendix" label="Sources and limitations">
          <CoveragePanel report={report} />

          <div className="mt-10">
            <Rule label="What this report could not establish" />
            <ul className="mt-4 space-y-5">
              {report.appendix.limitations.map((limitation) => (
                <li key={limitation.area} data-print-keep>
                  <h3 className="text-text text-[15px] font-medium">{limitation.area}</h3>
                  <p className="text-text-muted measure mt-1.5 text-[14px] leading-relaxed">
                    {limitation.detail}
                  </p>
                  {limitation.howToResolve && (
                    <p className="text-text-subtle measure mt-1.5 text-[13px] leading-relaxed">
                      {limitation.howToResolve}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {report.appendix.evidenceGaps.length > 0 && (
            <div className="mt-10">
              <Rule label="Specific gaps" />
              <ul className="mt-3 space-y-1.5">
                {report.appendix.evidenceGaps.map((gap) => (
                  <li key={gap} className="text-text-faint text-[13px]">
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-10">
            <Rule label={`All sources (${report.sources.length})`} />
            <ol className="mt-4 space-y-3">
              {report.sources.map((source) => (
                <li key={source.ref} className="flex gap-3">
                  <Meta className="text-signal w-8 shrink-0 pt-0.5">{source.ref}</Meta>
                  <div className="min-w-0">
                    <p className="text-text text-[13px] leading-snug">
                      {source.title ?? source.publisher ?? source.url}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Meta>{source.category.replace(/_/g, ' ')}</Meta>
                      <Meta>
                        {source.retrievalMode === 'direct'
                          ? 'read directly'
                          : 'index only'}
                      </Meta>
                      {source.publishedAt && <Meta>published {source.publishedAt}</Meta>}
                      <Meta>accessed {source.retrievedAt.slice(0, 10)}</Meta>
                    </div>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-cobalt mt-1 inline-block text-[12px] break-all underline-offset-4 hover:underline"
                    >
                      {source.url}
                    </a>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Helpers ─────────────────────────────────── */

function Section({
  id,
  label,
  hideHeading = false,
  children,
}: {
  id: string;
  label: string;
  hideHeading?: boolean;
  children: React.ReactNode;
}) {
  const index = REPORT_SECTIONS.findIndex((section) => section.id === id) + 1;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-28 border-t border-[var(--color-rule)] py-12 first:border-t-0 first:pt-0 md:py-16"
    >
      <h2
        id={`${id}-heading`}
        className={
          hideHeading
            ? 'sr-only'
            : 'font-display text-text mb-6 flex items-baseline gap-4 text-[26px] leading-tight md:text-[32px]'
        }
      >
        {!hideHeading && (
          <span className="meta text-text-faint">{String(index).padStart(2, '0')}</span>
        )}
        {label}
      </h2>
      {children}
    </section>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Rule label={label} />
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Meta>{label}</Meta>
      <p className="text-text measure mt-1.5 text-[15px] leading-relaxed">{value}</p>
    </div>
  );
}

function Finding({
  label,
  claim,
  path,
  lookup,
}: {
  label: string;
  claim: MarketEntryReport['executive']['attractiveness'];
  path: string;
  lookup: ReturnType<typeof buildLookup>;
}) {
  return (
    <div>
      <Rule label={label} />
      <p className="text-text measure mt-3 text-[15px] leading-relaxed">
        {claim.statement}
      </p>
      <div className="mt-2">
        <GradeChip grade={lookup.gradeAt(path)} />
      </div>
    </div>
  );
}
