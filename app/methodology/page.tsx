import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { BRAND, pageTitle } from '@/config/brand';
import {
  SEARCH_BUDGET,
  RETRIEVAL_BUDGET,
  QUALITY_THRESHOLDS,
  SYNTHESIS_BUDGET,
} from '@/config/report';
import {
  EVIDENCE_GRADES,
  EVIDENCE_GRADE_LABEL,
  EVIDENCE_GRADE_MEANING,
  EVIDENCE_GRADE_TOKEN,
} from '@/config/design';
import { AREA_LABEL, INVESTIGATION_AREAS } from '@/lib/research/plan';
import { SCORE_WEIGHTS, VERDICT_BANDS } from '@/lib/market-entry/scoring';

export const metadata: Metadata = {
  title: pageTitle('Research methodology'),
  description: `How ${BRAND.name} researches a market, what it will not do, and when it refuses to charge.`,
  alternates: { canonical: '/methodology' },
};

/**
 * The methodology page.
 *
 * Every number on it is imported from the configuration the server actually
 * enforces rather than written into the copy. A methodology page that drifts
 * from the system it describes is worse than no methodology page, because it is
 * a specific promise that has quietly stopped being true.
 */
export default function MethodologyPage() {
  const FACTORS: { id: keyof typeof SCORE_WEIGHTS; label: string; detail: string }[] = [
    {
      id: 'evidenceDepth',
      label: 'Evidence depth',
      detail: 'How many credible sources were found, and how many of them we opened.',
    },
    {
      id: 'regulatoryClarity',
      label: 'Regulatory clarity',
      detail: 'Requirements resting on a named authority, against the gaps still open.',
    },
    {
      id: 'demandSignal',
      label: 'Demand signal',
      detail: 'Demand statements that came from a source rather than from reasoning.',
    },
    {
      id: 'routeFit',
      label: 'Route fit',
      detail: 'Whether the recommended route is evidenced and compared against others.',
    },
    {
      id: 'riskLoad',
      label: 'Risk load',
      detail: 'The risk register, weighted by probability and impact. Inverted.',
    },
    {
      id: 'commercialViability',
      label: 'Commercial assessability',
      detail:
        'Whether the commercial case can be assessed at all from what was supplied.',
    },
    {
      id: 'competitiveClarity',
      label: 'Competitive clarity',
      detail: 'Competitors and substitutes that could be backed by evidence.',
    },
  ];

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-page)] px-5 py-16 md:px-8"
      >
        <Meta>Methodology</Meta>
        <h1 className="font-display text-text mt-3 max-w-[18ch] text-[36px] leading-[1.06] tracking-[var(--tracking-display)] md:text-[48px]">
          How the research is done, and what it will not do
        </h1>
        <p className="text-text-muted measure mt-5 text-[16px] leading-relaxed">
          Everything on this page is enforced by the system rather than described by it.
          The limits below are the limits the server applies, imported into this page from
          the same configuration the pipeline reads.
        </p>

        <Section id="plan" title="The research plan">
          <p className="text-text-muted measure text-[15px] leading-relaxed">
            The plan is built in code from your brief before a single search runs. Asking
            a model to choose its own queries would make the number of paid calls a model
            decision rather than a budget decision — and a model that decides how much to
            spend will eventually decide to spend more.
          </p>

          <div className="mt-8 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
            <Figure value={SEARCH_BUDGET.advanced} label="Deep searches" />
            <Figure value={SEARCH_BUDGET.basic} label="Focused searches" />
            <Figure value={SEARCH_BUDGET.total} label="Hard maximum" />
            <Figure value={RETRIEVAL_BUDGET.maxFetches} label="Pages opened" />
          </div>

          <p className="text-text-subtle measure mt-6 text-[14px] leading-relaxed">
            One synthesis pass follows, with at most{' '}
            {SYNTHESIS_BUDGET.maxRepairAttempts === 1
              ? 'one repair attempt'
              : 'no repairs'}{' '}
            if the output fails validation. The planner deliberately proposes more queries
            than the budget can grant, so the budget does real work and the ordering is a
            genuine statement of priority.
          </p>

          <Rule label="Investigation areas" className="mt-10" />
          <ol className="mt-4 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
            {INVESTIGATION_AREAS.map((area, index) => (
              <li
                key={area}
                className="border-rule flex items-baseline gap-4 border-b py-3"
              >
                <Meta className="text-signal w-6 shrink-0">
                  {String(index + 1).padStart(2, '0')}
                </Meta>
                <span className="text-text text-[14px]">{AREA_LABEL[area]}</span>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="sources" title="Which sources count">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <Rule label="Preferred" />
              <ul className="text-text-muted mt-3 space-y-1.5 text-[14px]">
                {[
                  'Government departments and ministries',
                  'Named regulators',
                  'Customs and tariff authorities',
                  'National statistics offices',
                  'Trade associations and chambers of commerce',
                  'Recognised industry publications',
                  'Established retailers and distributors',
                  'Credible news, company pages, public directories',
                ].map((item) => (
                  <li key={item} className="border-signal-dim border-l-2 pl-3">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Rule label="Never fetched" />
              <ul className="text-text-muted mt-3 space-y-1.5 text-[14px]">
                {[
                  'LinkedIn, Instagram, Facebook, TikTok, X',
                  'Pages behind a CAPTCHA',
                  'Pages disallowed by robots.txt',
                  'Anything behind an authentication wall',
                  'Your own website — we never ask for it and never read it',
                ].map((item) => (
                  <li key={item} className="border-copper-line border-l-2 pl-3">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-text-subtle mt-4 text-[13px] leading-relaxed">
                A page that refuses us is recorded in the report and skipped. It never
                fails an assessment: an authority&rsquo;s website being slow is our
                problem to disclose, not yours to be charged for.
              </p>
            </div>
          </div>
        </Section>

        <Section id="evidence" title="How a claim is labelled">
          <p className="text-text-muted measure text-[15px] leading-relaxed">
            The label is computed from the claim&rsquo;s declared basis and the metadata
            of the sources it cites. It is never chosen by the model, which is what stops
            a confident sentence looking like a verified one.
          </p>

          <dl className="mt-8 space-y-px">
            {EVIDENCE_GRADES.map((grade) => (
              <div
                key={grade}
                className="border-rule bg-ground-raised flex flex-col gap-2 border p-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="sm:w-44 sm:shrink-0">
                  <Badge tone="token" token={EVIDENCE_GRADE_TOKEN[grade]}>
                    {EVIDENCE_GRADE_LABEL[grade]}
                  </Badge>
                </dt>
                <dd className="text-text-muted text-[14px] leading-relaxed">
                  {EVIDENCE_GRADE_MEANING[grade]}
                </dd>
              </div>
            ))}
          </dl>

          <Panel edge="cobalt" className="mt-8">
            <div className="p-5">
              <p className="text-text measure text-[15px] leading-relaxed">
                A regulatory, financial or market-size claim needs a source we opened
                ourselves. Where the only support is a search-index summary, the claim is
                shown as unverified and the gap is recorded — never presented as a fact.
              </p>
            </div>
          </Panel>
        </Section>

        <Section id="scoring" title="How the readiness score is calculated">
          <p className="text-text-muted measure text-[15px] leading-relaxed">
            A documented, deterministic function of the finished report. The same report
            always produces the same number, and every factor carries the sentence
            explaining what it measured — because a score you cannot interrogate is one
            you either over-trust or dismiss.
          </p>

          <ol className="mt-8 space-y-px">
            {FACTORS.map((factor) => (
              <li
                key={factor.id}
                className="border-rule bg-ground-raised flex flex-col gap-1 border p-4 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <span className="meta text-signal sm:w-12 sm:shrink-0" data-numeric>
                  {Math.round(SCORE_WEIGHTS[factor.id] * 100)}%
                </span>
                <span className="text-text text-[14px] font-medium sm:w-56 sm:shrink-0">
                  {factor.label}
                </span>
                <span className="text-text-muted text-[14px] leading-relaxed">
                  {factor.detail}
                </span>
              </li>
            ))}
          </ol>

          <p className="text-text-subtle measure mt-6 text-[14px] leading-relaxed">
            {VERDICT_BANDS.promising} or above is <em>Promising</em>;{' '}
            {VERDICT_BANDS.conditional} to {VERDICT_BANDS.promising - 1} is{' '}
            <em>Promising with conditions</em>; below {VERDICT_BANDS.conditional} is{' '}
            <em>High risk</em>. A report that fails the evidence gate is{' '}
            <em>Insufficient evidence</em> and is never charged for.
          </p>
        </Section>

        <Section id="gate" title="When we refuse to charge">
          <p className="text-text-muted measure text-[15px] leading-relaxed">
            Your credit is reserved when an assessment starts and only spent once a usable
            report exists. If the public record cannot support one, the credit is returned
            automatically — there is nothing to claim and nobody to email.
          </p>

          <ul className="mt-8 space-y-2">
            {[
              `At least ${QUALITY_THRESHOLDS.minSources} unique credible sources.`,
              `At least ${QUALITY_THRESHOLDS.minIndependentPublishers} independent publishers, so eight pages from one site is not eight sources.`,
              `At least ${QUALITY_THRESHOLDS.minAuthoritativeForRegulatoryClaims} official, regulatory or trade sources wherever the report states regulatory requirements as fact.`,
              `At least ${QUALITY_THRESHOLDS.minCompetitors} evidence-backed competitors or substitutes, where the market has them.`,
              'A route-to-market recommendation supported by a comparison.',
              'An explicit statement of what could not be established.',
              'No placeholder companies, and no fabricated quantitative claims.',
            ].map((item) => (
              <li
                key={item}
                className="text-text-muted border-signal-dim border-l-2 pl-3 text-[14px] leading-relaxed"
              >
                {item}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="beta" title="Access during the beta">
          <p className="text-text-muted measure text-[15px] leading-relaxed">
            One assessment costs one {BRAND.credit.singular}. There is no payment
            integration and nothing to buy: credits are granted manually while the product
            is in beta. If you need one, write to {BRAND.supportEmail}.
          </p>
          <p className="text-text-subtle measure mt-4 text-[14px] leading-relaxed">
            {BRAND.credit.disclaimer}
          </p>
        </Section>

        <Section id="limits" title="What this is not">
          <p className="text-text-muted measure text-[15px] leading-relaxed">
            A market-entry report is research assembled from public sources. It is not
            legal, regulatory or financial advice, it is not a substitute for a
            conversation with a distributor or a qualified adviser, and it is not a
            guarantee. Regulatory requirements are reported as the named authority
            publishes them, and they change. Confirm anything you are about to spend money
            against before you spend it.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/assess">Assess a market</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/example">Read the worked example</Link>
            </Button>
          </div>
        </Section>
      </main>

      <SiteFooter />
    </>
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
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="border-rule scroll-mt-24 border-t py-14 first:border-t-0 md:py-16"
    >
      <h2
        id={`${id}-heading`}
        className="font-display text-text mb-6 text-[26px] leading-tight md:text-[32px]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div className="border-rule bg-ground-raised border p-5">
      <p className="font-display text-signal text-[36px] leading-none" data-numeric>
        {value}
      </p>
      <p className="text-text-muted mt-2 text-[13px]">{label}</p>
    </div>
  );
}
