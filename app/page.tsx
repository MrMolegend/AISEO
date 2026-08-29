import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { FlashNotice } from '@/components/layout/flash-notice';
import { SiteFooter } from '@/components/layout/site-footer';
import { DossierVisual } from '@/components/marketing/dossier-visual';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { Reveal } from '@/components/ui/reveal';
import { Badge } from '@/components/ui/badge';
import { BRAND, pageTitle } from '@/config/brand';
import { SEARCH_BUDGET, QUALITY_THRESHOLDS } from '@/config/report';
import {
  EVIDENCE_GRADES,
  EVIDENCE_GRADE_LABEL,
  EVIDENCE_GRADE_MEANING,
  EVIDENCE_GRADE_TOKEN,
} from '@/config/design';
import { STAGE_IDS, STAGE_TITLES, STAGE_PURPOSE } from '@/schemas/market-entry/input';
import { PLAN_PHASES, PLAN_PHASE_LABEL } from '@/schemas/market-entry/report';
import { AREA_LABEL, INVESTIGATION_AREAS } from '@/lib/research/plan';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: pageTitle(),
  description: BRAND.description,
  alternates: { canonical: '/' },
};

/**
 * The landing page.
 *
 * Composed as an editorial spread rather than a stack of equal cards: an
 * asymmetric hero, full-bleed bands that change ground, numbered sections with
 * a monospace rail, and real product components wherever a screenshot would
 * otherwise have gone. Nothing here is a picture of the product pretending to
 * be the product.
 */
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ 'signed-out'?: string }>;
}) {
  const signedOut = Boolean((await searchParams)['signed-out']);
  const user = await getCurrentUser();
  const startHref = user ? '/assess' : '/sign-in?next=%2Fassess';

  return (
    <>
      <SiteHeader />

      <main id="main">
        {signedOut && (
          <div className="mx-auto max-w-[var(--container-page)] px-5 pt-8 md:px-8">
            <FlashNotice kind="signed-out" />
          </div>
        )}

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[var(--container-page)] px-5 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <Meta>Market entry intelligence</Meta>
              <h1 className="font-display text-text mt-5 text-[42px] leading-[1.02] tracking-[var(--tracking-display)] sm:text-[56px] lg:text-[64px]">
                Enter new markets with evidence.
              </h1>
              <p className="text-text-muted measure mt-6 text-[17px] leading-relaxed">
                Describe what you sell and where you want to expand. {BRAND.name}{' '}
                researches the market, tests the commercial case and builds a practical
                90-day entry strategy.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link href={startHref}>Assess a market</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/example">Explore an example</Link>
                </Button>
              </div>

              <p className="text-text-faint mt-6 text-[13px] leading-relaxed">
                No website required. We never ask for your URL and never crawl your site.
              </p>
            </div>

            <Reveal>
              <DossierVisual />
            </Reveal>
          </div>
        </section>

        {/* ── 1. What decision are you making? ─────────────────────────── */}
        <Band>
          <SectionHead
            index="01"
            title="What decision are you actually making?"
            lede="Not “tell me about a market”. Every one of these is a commitment of money you cannot easily unwind, and each needs a different thing proven before you make it."
          />
          <div className="mt-10 grid gap-px md:grid-cols-3">
            {[
              {
                q: 'Should we appoint a distributor here?',
                a: 'What the agreement would lock you into, who the credible partners are, and what the alternative routes cost.',
              },
              {
                q: 'Can we price into this market at all?',
                a: 'What comparable products sell for, what the chain takes, and whether your cost base survives the journey.',
              },
              {
                q: 'What would stop us at the border?',
                a: 'Registration, labelling, certification and duty — from the authorities that publish them, with the gaps named.',
              },
            ].map((item, index) => (
              <Reveal key={item.q} index={index}>
                <div className="border-rule bg-ground-raised h-full border p-6">
                  <h3 className="font-display text-text text-[20px] leading-snug">
                    {item.q}
                  </h3>
                  <p className="text-text-muted mt-3 text-[14px] leading-relaxed">
                    {item.a}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Band>

        {/* ── 2. What the product researches ───────────────────────────── */}
        <Section id="what-we-research">
          <SectionHead
            index="02"
            title={`What ${BRAND.name} researches`}
            lede="Ten investigation areas, planned server-side from your brief before a single search runs — so the cost of a report is a budget decision rather than something the model talks itself into."
          />
          <ol className="mt-10 grid gap-x-10 gap-y-px sm:grid-cols-2 lg:grid-cols-3">
            {INVESTIGATION_AREAS.filter((area) => area !== 'key-question').map(
              (area, index) => (
                <li
                  key={area}
                  className="border-rule flex items-baseline gap-4 border-b py-4"
                >
                  <Meta className="text-signal w-6 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </Meta>
                  <span className="text-text text-[15px]">{AREA_LABEL[area]}</span>
                </li>
              ),
            )}
            <li className="border-signal-dim flex items-baseline gap-4 border-b py-4">
              <Meta className="text-signal w-6 shrink-0">+</Meta>
              <span className="text-text text-[15px]">
                {AREA_LABEL['key-question']} — asked as its own search
              </span>
            </li>
          </ol>
        </Section>

        {/* ── 3. Example report preview ────────────────────────────────── */}
        <Band>
          <SectionHead
            index="03"
            title="A dossier, not a long answer"
            lede="Twelve sections, a server-computed verdict, and an evidence label on every claim. This is the real report component rendering the worked example — open it and read the whole thing."
          />
          <div className="mt-10">
            <Reveal>
              <Panel edge="signal">
                <div className="p-6 md:p-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="token" token="verdict-promising">
                      Promising
                    </Badge>
                    <Meta>Readiness 83 / 100 · Confidence high</Meta>
                  </div>
                  <h3 className="font-display text-text mt-4 text-[26px] leading-tight">
                    Ardmore Sea Salt · Ireland → United Arab Emirates
                  </h3>
                  <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
                    There is a real route to shelf for a producer of this size, and it
                    runs through a consolidating importer rather than a direct retail
                    relationship. The binding constraint is not demand: import
                    registration must be held by a locally licensed entity, so the
                    distributor decision comes before the sales decision rather than after
                    it.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/example">Read the full example</Link>
                    </Button>
                    <Meta className="self-center">
                      Fictional business · demonstration sources
                    </Meta>
                  </div>
                </div>
              </Panel>
            </Reveal>
          </div>
        </Band>

        {/* ── 4. Research methodology ──────────────────────────────────── */}
        <Section id="how-it-works">
          <SectionHead
            index="04"
            title="How the research is bounded"
            lede="A report that could search forever would cost whatever it felt like and finish whenever it liked. Every limit below is enforced on the server, not suggested to the model."
          />
          <div className="mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              value={`${SEARCH_BUDGET.advanced}`}
              label="Deep searches"
              note="Broad discovery: market conditions, regulation, distribution."
            />
            <Stat
              value={`${SEARCH_BUDGET.basic}`}
              label="Focused searches"
              note="Follow-ups on competitors, pricing, buyers, barriers."
            />
            <Stat
              value={`${SEARCH_BUDGET.total}`}
              label="Hard maximum"
              note="Claimed from a budget before each call, never after."
            />
            <Stat
              value="1"
              label="Synthesis"
              note="One analysis pass, and at most one repair if it fails validation."
            />
          </div>
          <p className="text-text-subtle measure mt-8 text-[14px] leading-relaxed">
            We then open the most authoritative sources ourselves rather than trusting a
            search engine&rsquo;s summary of them. Pages that refuse automated access are
            recorded and skipped — a ministry&rsquo;s website being slow is never a reason
            for your report to fail.
          </p>
          <p className="text-text-subtle measure mt-3 text-[14px] leading-relaxed">
            We do not crawl LinkedIn, Instagram, Facebook, TikTok or X, do not circumvent
            CAPTCHAs or authentication walls, and do not ignore robots.txt.
          </p>
        </Section>

        {/* ── 5. Evidence and confidence ───────────────────────────────── */}
        <Band>
          <SectionHead
            index="05"
            title="Every claim says where it came from"
            lede="Five labels, applied by the system rather than chosen by the model, so a sentence can never award itself authority it has not got."
          />
          <dl className="mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-5">
            {EVIDENCE_GRADES.map((grade, index) => (
              <Reveal key={grade} index={index}>
                <div className="border-rule bg-ground-raised h-full border p-5">
                  <dt>
                    <Badge tone="token" token={EVIDENCE_GRADE_TOKEN[grade]}>
                      {EVIDENCE_GRADE_LABEL[grade]}
                    </Badge>
                  </dt>
                  <dd className="text-text-muted mt-3 text-[13px] leading-relaxed">
                    {EVIDENCE_GRADE_MEANING[grade]}
                  </dd>
                </div>
              </Reveal>
            ))}
          </dl>
          <p className="text-text-subtle measure mt-8 text-[14px] leading-relaxed">
            A regulatory, financial or market-size claim needs a source we opened
            ourselves. If the only support is a search-index summary, the claim is shown
            as unverified with the gap recorded — never dressed up as a fact.
          </p>
        </Band>

        {/* ── 6. Four-stage intake ─────────────────────────────────────── */}
        <Section id="intake">
          <SectionHead
            index="06"
            title="Four stages, about ten minutes"
            lede="No website address, no document uploads, no account questionnaire. What you sell is something you can describe better than a homepage can."
          />
          <ol className="mt-10 grid gap-px md:grid-cols-4">
            {STAGE_IDS.map((key, index) => (
              <li key={key} className="border-rule bg-ground-raised border p-5">
                <Meta className="text-signal">
                  Stage {String(index + 1).padStart(2, '0')}
                </Meta>
                <h3 className="text-text mt-2 text-[15px] font-medium">
                  {STAGE_TITLES[key]}
                </h3>
                <p className="text-text-muted mt-2 text-[13px] leading-relaxed">
                  {STAGE_PURPOSE[key]}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── 7. 30/60/90 output ───────────────────────────────────────── */}
        <Band>
          <SectionHead
            index="07"
            title="It ends in a plan you can start on Monday"
            lede="Every action carries a priority, an owner, an expected outcome, what it depends on, and the evidence or reasoning behind it."
          />
          <div className="mt-10 grid gap-px md:grid-cols-3">
            {PLAN_PHASES.map((phase, index) => {
              const [range, purpose] = PLAN_PHASE_LABEL[phase].split(' · ');
              return (
                <Reveal key={phase} index={index}>
                  <div className="border-rule bg-ground-raised h-full border p-6">
                    <Meta className="text-signal">{range}</Meta>
                    <h3 className="font-display text-text mt-2 text-[20px] leading-snug">
                      {purpose}
                    </h3>
                    <p className="text-text-muted mt-3 text-[14px] leading-relaxed">
                      {
                        [
                          'Qualify partners, price the fixed costs of entry, and close the regulatory questions the research could not.',
                          'Commit to one partner on trial terms, submit what needs registering, and test the route rather than only the product.',
                          'Ship at the smallest viable volume, get a real landed cost, and hold the second-year decision against evidence.',
                        ][index]
                      }
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </Band>

        {/* ── 8. Appropriate use and limitations ───────────────────────── */}
        <Section id="limitations">
          <SectionHead
            index="08"
            title="What this is not"
            lede="Worth reading before you buy rather than after."
          />
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <ul className="space-y-4">
              {[
                'Not legal or regulatory advice. Requirements are reported as the authorities publish them, with the authority named so you can confirm before spending.',
                'Not a substitute for a visit, a distributor conversation or a lawyer. It is the work you would do before any of those are worth paying for.',
                'Not a guarantee. A market can be well-evidenced and still be the wrong decision for your business.',
              ].map((item) => (
                <li key={item} className="border-copper-line border-l-[3px] pl-4">
                  <p className="text-text-muted text-[14px] leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>
            <ul className="space-y-4">
              {[
                `A report needs at least ${QUALITY_THRESHOLDS.minSources} credible independent sources. If the public record cannot support one, we say so and return your credit rather than padding it.`,
                'Thinly documented markets and niche categories produce thinner reports. The limitations section says exactly where.',
                'We never invent a market size, a price, a tariff rate or a contact. An unavailable figure is reported as unavailable.',
              ].map((item) => (
                <li key={item} className="border-signal-dim border-l-[3px] pl-4">
                  <p className="text-text-muted text-[14px] leading-relaxed">{item}</p>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* ── 9. Final CTA ─────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[var(--container-page)] px-5 pt-4 pb-24 md:px-8">
          <Panel edge="signal">
            <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between md:p-10">
              <div>
                <h2 className="font-display text-text text-[30px] leading-tight md:text-[36px]">
                  Which market are you weighing up?
                </h2>
                <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
                  Four stages, one dossier, and a credit that comes back automatically if
                  the evidence will not support an answer.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link href={startHref}>Assess a market</Link>
              </Button>
            </div>
          </Panel>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/* ─────────────────────────────── Layout ──────────────────────────────────── */

function Section({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className="mx-auto max-w-[var(--container-page)] scroll-mt-24 px-5 py-20 md:px-8 md:py-24"
    >
      {children}
    </section>
  );
}

/** A full-bleed change of ground. What stops the page reading as one long list. */
function Band({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-rule bg-ground-sunken border-y">
      <div className="mx-auto max-w-[var(--container-page)] px-5 py-20 md:px-8 md:py-24">
        {children}
      </div>
    </section>
  );
}

function SectionHead({
  index,
  title,
  lede,
}: {
  index: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr] md:gap-10">
      <Meta className="text-signal md:pt-3">{index}</Meta>
      <div>
        <h2 className="font-display text-text max-w-[18ch] text-[30px] leading-[1.1] tracking-[var(--tracking-display)] md:text-[40px]">
          {title}
        </h2>
        <p className="text-text-muted measure mt-4 text-[15px] leading-relaxed">{lede}</p>
      </div>
    </div>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="border-rule bg-ground-raised border p-5">
      <p className="font-display text-signal text-[40px] leading-none" data-numeric>
        {value}
      </p>
      <p className="text-text mt-3 text-[14px] font-medium">{label}</p>
      <p className="text-text-muted mt-1.5 text-[13px] leading-relaxed">{note}</p>
      <Rule className="mt-4" />
    </div>
  );
}
