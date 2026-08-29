import { Badge } from '@/components/ui/badge';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { DataTable, Th, Td } from '@/components/ui/data-table';
import { VERDICT_LABEL, VERDICT_TOKEN } from '@/config/design';
import { countryName, currencyFor } from '@/config/markets';
import { type ROUTE_OPTION_IDS } from '@/schemas/market-entry/report';
import type { MarketEntryReport } from '@/schemas/market-entry/report';
import { Claim, ClaimList, type SourceLookup } from './evidence';

/**
 * The structured panels: decision header, risk matrix, route comparison,
 * commercial scenarios, timeline and coverage.
 *
 * These exist as tables, matrices and rails rather than as more cards, which is
 * the difference between a report you can compare things in and a report you
 * scroll. A risk register is a grid because probability against impact is a
 * two-dimensional question; a route comparison is a table because the reader is
 * doing a column-by-column comparison whether the layout helps or not.
 */

const ROUTE_LABELS: Record<(typeof ROUTE_OPTION_IDS)[number], string> = {
  'direct-wholesale': 'Direct wholesale',
  'local-distributor': 'Local distributor',
  'retail-partnership': 'Retail partnership',
  ecommerce: 'Ecommerce',
  agent: 'Agent representation',
  'direct-corporate': 'Direct corporate sales',
};

const SUITABILITY_TOKEN = {
  strong: 'verdict-promising',
  possible: 'verdict-conditional',
  weak: 'verdict-risk',
  unsuitable: 'grade-unknown',
} as const;

/* ───────────────────────── 1. Decision header ────────────────────────────── */

export function DecisionHeader({ report }: { report: MarketEntryReport }) {
  const { decision } = report;

  return (
    <Panel edge={VERDICT_TOKEN[decision.verdict]} className="overflow-hidden">
      <div className="grid grid-cols-1 gap-px md:grid-cols-[1.5fr_1fr]">
        <div className="p-6 md:p-8">
          <Meta>
            {countryName(decision.originCountry)} → {countryName(decision.targetCountry)}
            {decision.targetRegion ? ` · ${decision.targetRegion}` : ''}
          </Meta>
          <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[38px]">
            {decision.businessName}
          </h1>
          <p className="text-text-muted mt-1 text-[15px]">{decision.productName}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Badge tone="token" token={VERDICT_TOKEN[decision.verdict]}>
              {VERDICT_LABEL[decision.verdict]}
            </Badge>
            <Meta>Confidence {decision.confidence}</Meta>
            <Meta>Researched {decision.researchedAt.slice(0, 10)}</Meta>
          </div>

          {/* The decision, at the top of the decision document.
              Someone who reads only this panel should still leave knowing what
              they are being told to decide next — and it fills a column that
              would otherwise be empty beside a tall score breakdown. */}
          <div className="border-rule mt-7 border-t pt-5">
            <Meta>The next decision</Meta>
            <p className="text-text measure mt-2 text-[15px] leading-relaxed">
              {report.executive.recommendedNextDecision}
            </p>
          </div>
        </div>

        {/* The score, and immediately underneath it the factors that produced
            it. A number a reader cannot interrogate is a number they either
            over-trust or dismiss. */}
        <div className="border-rule bg-ground-sunken border-l p-6 md:p-8">
          <Meta>Readiness</Meta>
          <p
            className="font-display text-text mt-1 text-[48px] leading-none"
            data-numeric
          >
            {decision.readiness}
            <span className="text-text-faint text-[20px]"> / 100</span>
          </p>

          <ul className="mt-5 space-y-2.5">
            {decision.factors.map((factor) => (
              <li key={factor.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-text-muted text-[12px]">{factor.label}</span>
                  <span className="meta text-text-faint">
                    {Math.round(factor.weight * 100)}%
                  </span>
                </div>
                <div
                  className="bg-ground mt-1 h-1"
                  role="img"
                  aria-label={`${factor.label}: ${Math.round(factor.score * 100)} out of 100. ${factor.explanation}`}
                >
                  <div
                    className="bg-signal h-full origin-left"
                    style={{ width: `${Math.round(factor.score * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}

/* ───────────────────────── 10. Risk matrix ───────────────────────────────── */

const AXIS = ['high', 'medium', 'low'] as const;

export function RiskMatrix({
  report,
  lookup,
}: {
  report: MarketEntryReport;
  lookup: SourceLookup;
}) {
  const cell = (probability: string, impact: string) =>
    report.risks.filter(
      (risk) => risk.probability === probability && risk.impact === impact,
    );

  return (
    <div className="space-y-8">
      {/* The matrix is a summary, not the content. It is labelled as a figure
          and the register below carries every risk in full, so nothing is
          reachable only by reading a grid. */}
      <figure>
        <figcaption className="sr-only">
          Risks plotted by probability against impact. Every risk is also listed in full
          below.
        </figcaption>
        <DataTable
          caption="Risks by probability and impact"
          captionId="risk-matrix-caption"
          minWidth={420}
        >
          <thead>
            <tr>
              <Th scope="col">
                <span className="sr-only">Probability</span>
              </Th>
              {AXIS.map((impact) => (
                <Th key={impact} scope="col">
                  {impact} impact
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AXIS.map((probability) => (
              <tr key={probability}>
                <Th scope="row" className="align-middle">
                  {probability} probability
                </Th>
                {AXIS.map((impact) => {
                  const risks = cell(probability, impact);
                  const severe =
                    probability !== 'low' && impact !== 'low' && risks.length > 0;
                  return (
                    <Td key={impact} className={severe ? 'bg-copper-surface' : undefined}>
                      {risks.length === 0 ? (
                        <span className="text-text-faint text-[13px]">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {risks.map((risk) => (
                            <li key={risk.id}>
                              <a
                                href={`#risk-${risk.id}`}
                                className="text-text text-[13px] underline-offset-4 hover:underline"
                              >
                                {risk.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </DataTable>
      </figure>

      <ol className="space-y-6">
        {report.risks.map((risk, index) => (
          <li
            key={risk.id}
            id={`risk-${risk.id}`}
            className="scroll-mt-24"
            data-print-keep
          >
            <div className="flex flex-wrap items-center gap-2">
              <Meta className="text-signal">R{index + 1}</Meta>
              <Badge
                size="sm"
                tone={
                  risk.probability !== 'low' && risk.impact !== 'low'
                    ? 'copper'
                    : 'neutral'
                }
              >
                {risk.probability} probability · {risk.impact} impact
              </Badge>
            </div>
            <h3 className="text-text mt-2 text-[16px] font-medium">{risk.title}</h3>
            <p className="text-text-muted measure mt-2 text-[14px] leading-relaxed">
              {risk.description}
            </p>
            <p className="text-text measure mt-3 text-[14px] leading-relaxed">
              <span className="meta text-text-faint mr-2">Mitigation</span>
              {risk.mitigation}
            </p>
            {risk.evidence.length > 0 && (
              <ClaimList
                claims={risk.evidence}
                path={`risks[${index}].evidence`}
                lookup={lookup}
              />
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ──────────────────────── 7. Route comparison ────────────────────────────── */

export function RouteComparison({
  report,
  lookup,
}: {
  report: MarketEntryReport;
  lookup: SourceLookup;
}) {
  return (
    <div className="space-y-8">
      <DataTable
        caption="Routes to market compared by suitability, requirements and risks"
        captionId="route-comparison-caption"
        minWidth={720}
      >
        <thead>
          <tr>
            <Th scope="col">Route</Th>
            <Th scope="col">Suitability</Th>
            <Th scope="col">Requires</Th>
            <Th scope="col">Risks</Th>
          </tr>
        </thead>
        <tbody>
          {report.route.options.map((option) => (
            <tr key={option.id}>
              <Th scope="row" className="text-text text-[14px] normal-case">
                {ROUTE_LABELS[option.id]}
                {option.id === report.route.primary && (
                  <Badge tone="signal" size="sm" className="ml-2">
                    Recommended
                  </Badge>
                )}
                {option.id === report.route.fallback && (
                  <Badge tone="neutral" size="sm" className="ml-2">
                    Fallback
                  </Badge>
                )}
              </Th>
              <Td>
                <Badge
                  tone="token"
                  token={SUITABILITY_TOKEN[option.suitability]}
                  size="sm"
                >
                  {option.suitability}
                </Badge>
              </Td>
              <Td>
                <ul className="space-y-1">
                  {option.requirements.map((item) => (
                    <li key={item} className="text-text-muted text-[13px]">
                      {item}
                    </li>
                  ))}
                </ul>
              </Td>
              <Td>
                <ul className="space-y-1">
                  {option.risks.length === 0 ? (
                    <li className="text-text-faint text-[13px]">—</li>
                  ) : (
                    option.risks.map((item) => (
                      <li key={item} className="text-text-muted text-[13px]">
                        {item}
                      </li>
                    ))
                  )}
                </ul>
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <Panel edge="signal">
        <div className="p-6">
          <Meta>Recommendation</Meta>
          <p className="text-text measure mt-2 text-[15px] leading-relaxed">
            {report.route.recommendation}
          </p>
          <Rule label="First steps" className="mt-6" />
          <ol className="mt-3 space-y-2">
            {report.route.firstSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <Meta className="text-signal w-6 shrink-0 pt-0.5">
                  {String(index + 1).padStart(2, '0')}
                </Meta>
                <span className="text-text-muted text-[14px] leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Panel>

      {report.route.options
        .filter((option) => option.evidence.length > 0)
        .map((option) => (
          <div key={option.id}>
            <Rule label={ROUTE_LABELS[option.id]} />
            <ClaimList
              claims={option.evidence}
              path={`route.options[${report.route.options.indexOf(option)}].evidence`}
              lookup={lookup}
            />
          </div>
        ))}
    </div>
  );
}

/* ───────────────────── 8. Commercial scenarios ───────────────────────────── */

export function Scenarios({ report }: { report: MarketEntryReport }) {
  if (report.scenarios.length === 0) {
    return (
      <p className="text-text-faint text-[14px] leading-relaxed">
        No margin scenario could be calculated: no currency was supplied, so the figures
        entered are not amounts.
      </p>
    );
  }

  const money = (minor: number | null, code: string): string => {
    if (minor === null) return '—';
    const symbol = currencyFor(code)?.symbol ?? '';
    return `${symbol}${(minor / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      <DataTable
        caption="Gross margin at each price point, from the figures you supplied"
        captionId="scenario-caption"
        minWidth={560}
      >
        <thead>
          <tr>
            <Th scope="col">Scenario</Th>
            <Th scope="col">Price</Th>
            <Th scope="col">Unit cost</Th>
            <Th scope="col">Gross margin</Th>
            <Th scope="col">Margin %</Th>
          </tr>
        </thead>
        <tbody>
          {report.scenarios.map((scenario) => (
            <tr key={scenario.id}>
              <Th scope="row" className="text-text text-[14px] normal-case">
                {scenario.label}
                {scenario.missingInputs.length > 0 && (
                  <span className="text-text-faint mt-0.5 block text-[12px] normal-case">
                    Needs: {scenario.missingInputs.join(', ')}
                  </span>
                )}
              </Th>
              <Td data-numeric>{money(scenario.sellingPriceMinor, scenario.currency)}</Td>
              <Td data-numeric>{money(scenario.unitCostMinor, scenario.currency)}</Td>
              <Td data-numeric>{money(scenario.grossMarginMinor, scenario.currency)}</Td>
              <Td data-numeric>
                {scenario.grossMarginPercent === null
                  ? '—'
                  : `${scenario.grossMarginPercent}%`}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <p className="text-text-faint text-[12px] leading-relaxed">
        Calculated from the figures you entered, before freight, duty, distributor margin
        or retailer margin. A dash means an input was not supplied — nothing here is
        estimated on your behalf.
      </p>
    </div>
  );
}

/* ────────────────────── 11. 30/60/90 timeline ────────────────────────────── */

export function Timeline({ report }: { report: MarketEntryReport }) {
  const byPhase = (phase: string) =>
    report.plan.actions.filter((action) => action.phase === phase);

  const PHASES = [
    { id: 'days-1-30', label: 'Days 1–30', purpose: 'Validation and preparation' },
    { id: 'days-31-60', label: 'Days 31–60', purpose: 'Partnerships and testing' },
    { id: 'days-61-90', label: 'Days 61–90', purpose: 'Controlled launch' },
  ] as const;

  return (
    <div className="space-y-10">
      {PHASES.map((phase) => (
        <section key={phase.id} aria-labelledby={`phase-${phase.id}`}>
          <div className="flex flex-wrap items-baseline gap-3">
            <Meta className="text-signal">{phase.label}</Meta>
            <h3 id={`phase-${phase.id}`} className="text-text text-[16px] font-medium">
              {phase.purpose}
            </h3>
          </div>
          <Rule className="mt-2" />

          <ol className="mt-4 space-y-5">
            {byPhase(phase.id).map((action) => (
              <li
                key={action.id}
                className="border-rule border-l-2 pl-4 md:pl-5"
                data-print-keep
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    size="sm"
                    tone={action.priority === 'critical' ? 'copper' : 'neutral'}
                  >
                    {action.priority}
                  </Badge>
                  <Meta>{action.owner.replace(/-/g, ' ')}</Meta>
                  {action.dependsOn && <Meta>after: {action.dependsOn}</Meta>}
                </div>
                <h4 className="text-text mt-2 text-[15px] font-medium">{action.title}</h4>
                <p className="text-text-muted measure mt-1.5 text-[14px] leading-relaxed">
                  {action.detail}
                </p>
                <p className="text-text-subtle measure mt-2 text-[13px] leading-relaxed">
                  <span className="meta text-text-faint mr-2">Outcome</span>
                  {action.expectedOutcome}
                </p>
                <p className="text-text-faint measure mt-1.5 text-[13px] leading-relaxed">
                  <span className="meta mr-2">Why</span>
                  {action.reasoning}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

/* ─────────────────────── 12. Research coverage ───────────────────────────── */

export function CoveragePanel({ report }: { report: MarketEntryReport }) {
  const { coverage } = report;

  return (
    <div className="space-y-6">
      <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Sources used', value: coverage.sourcesAccepted },
          { label: 'Read directly', value: coverage.directlyRetrieved },
          { label: 'Official or trade', value: coverage.authoritative },
          { label: 'Distinct publishers', value: coverage.distinctPublishers },
        ].map((stat) => (
          <div key={stat.label} className="border-rule bg-ground-raised border p-4">
            <p className="font-display text-text text-[28px] leading-none" data-numeric>
              {stat.value}
            </p>
            <p className="text-text-subtle mt-2 text-[13px]">{stat.label}</p>
          </div>
        ))}
      </div>

      {coverage.blocked.length > 0 && (
        <div>
          <Rule label="Could not be read" />
          <p className="text-text-subtle measure mt-3 text-[13px] leading-relaxed">
            These pages were found but refused or failed automated access. They are cited
            from their index summaries only, and any claim resting on one is labelled
            unverified. Each is usually readable in a browser.
          </p>
          <ul className="mt-3 space-y-2">
            {coverage.blocked.map((blocked) => (
              <li key={blocked.url} className="border-copper-line border-l-2 pl-3">
                <p className="text-text text-[13px]">
                  {blocked.publisher ?? blocked.url}
                </p>
                <Meta>{blocked.reason.replace(/-/g, ' ')}</Meta>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A single competitor row. Deliberately not a card: they are compared, not browsed. */
export function CompetitorEntry({
  entry,
  index,
  lookup,
}: {
  entry: MarketEntryReport['competitive']['entries'][number];
  index: number;
  lookup: SourceLookup;
}) {
  const base = `competitive.entries[${index}]`;

  return (
    <li className="border-rule border-t pt-6" data-print-keep>
      <div className="flex flex-wrap items-center gap-2">
        <Meta className="text-signal">{String(entry.rank).padStart(2, '0')}</Meta>
        <Badge size="sm" tone={entry.kind === 'direct' ? 'signal' : 'neutral'}>
          {entry.kind}
        </Badge>
        <Meta>confidence {entry.confidence}</Meta>
      </div>

      <h3 className="font-display text-text mt-2 text-[22px] leading-tight">
        {entry.name}
      </h3>
      <p className="text-text-muted measure mt-2 text-[14px] leading-relaxed">
        {entry.whyRelevant}
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <div>
          <Rule label="Overlap" />
          <ul className="mt-1">
            <Claim
              claim={entry.productOverlap}
              path={`${base}.productOverlap`}
              lookup={lookup}
            />
            <Claim
              claim={entry.customerOverlap}
              path={`${base}.customerOverlap`}
              lookup={lookup}
            />
            <Claim
              claim={entry.marketPresence}
              path={`${base}.marketPresence`}
              lookup={lookup}
            />
          </ul>
        </div>

        <div className="space-y-5">
          <div>
            <Rule label="Positioning" />
            <p className="text-text-muted mt-2 text-[14px] leading-relaxed">
              {entry.positioning}
            </p>
          </div>

          <div>
            <Rule label="Strengths" />
            <ClaimList
              claims={entry.strengths}
              path={`${base}.strengths`}
              lookup={lookup}
            />
          </div>

          {entry.gaps.length > 0 && (
            <div>
              <Rule label="Gaps" />
              <ClaimList claims={entry.gaps} path={`${base}.gaps`} lookup={lookup} />
            </div>
          )}

          {entry.unknowns.length > 0 && (
            <div>
              <Rule label="Not established" />
              <p className="text-text-faint mt-2 text-[13px]">
                {entry.unknowns.join(' · ')}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
