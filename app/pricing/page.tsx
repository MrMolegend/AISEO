import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BRAND, pageTitle } from '@/config/brand';
import { PACKAGE_LIST } from '@/config/packages';
import {
  BUNDLE_LIST,
  PRICING_NOTES,
  PURCHASING_ENABLED,
  formatPrice,
  formatTokens,
  pricePerToken,
} from '@/config/tokens';

export const metadata: Metadata = {
  title: pageTitle('Pricing'),
  description: `${BRAND.currency.name} bundles and what each research package costs.`,
  alternates: { canonical: '/pricing' },
};

/**
 * Pricing.
 *
 * Purchasing is not implemented, and this page says so plainly rather than
 * showing a button that would fail. Nothing here creates a checkout session,
 * fake or otherwise: a "Buy" button that silently does nothing is worse than an
 * honest disabled state, because the user cannot tell whether it worked.
 */
export default function PricingPage() {
  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[1240px] px-5 py-16 md:px-8 md:py-20">
        <div className="max-w-[640px]">
          <h1 className="text-text text-[38px] leading-tight font-semibold tracking-[var(--tracking-display)]">
            Pricing
          </h1>
          <p className="text-text-muted mt-4 text-lg leading-relaxed">
            Buy {BRAND.currency.name} once, spend them on whichever reports you need.
          </p>
        </div>

        {/* ── Bundles ───────────────────────────────────────────────────── */}
        <section aria-labelledby="bundles-heading" className="mt-14">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <h2
              id="bundles-heading"
              className="text-text text-[22px] font-semibold tracking-[var(--tracking-tight)]"
            >
              Token bundles
            </h2>
            {!PURCHASING_ENABLED && <Badge tone="neutral">Purchasing coming soon</Badge>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {BUNDLE_LIST.map((bundle) => (
              <Card key={bundle.id} raised={bundle.highlighted}>
                <CardBody className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-text text-[17px] font-semibold">{bundle.name}</h3>
                    {bundle.highlighted && (
                      <Badge tone="brand" size="sm">
                        Most useful
                      </Badge>
                    )}
                  </div>

                  <p className="text-text mt-4 text-[32px] leading-none font-semibold tabular-nums">
                    {formatPrice(bundle.priceMinorUnits)}
                  </p>
                  <p className="text-text-muted mt-2 text-sm tabular-nums">
                    {formatTokens(bundle.tokens)} {BRAND.currency.plural} ·{' '}
                    {(pricePerToken(bundle) / 100).toFixed(3).replace(/0+$/, '')}p each
                  </p>

                  <p className="text-text-subtle mt-4 text-sm leading-relaxed">
                    {bundle.blurb}
                  </p>

                  <div className="mt-auto pt-6">
                    <button
                      type="button"
                      disabled
                      aria-describedby={`bundle-${bundle.id}-note`}
                      className="border-rule bg-ground-sunken text-text-faint inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-[var(--radius-control)] border px-5 text-[15px] font-medium"
                    >
                      Coming soon
                    </button>
                    <p
                      id={`bundle-${bundle.id}-note`}
                      className="text-text-faint mt-2 text-center text-xs"
                    >
                      Payments are not yet available
                    </p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* ── What each report costs ────────────────────────────────────── */}
        <section aria-labelledby="costs-heading" className="mt-16">
          <h2
            id="costs-heading"
            className="text-text text-[22px] font-semibold tracking-[var(--tracking-tight)]"
          >
            What each report costs
          </h2>

          {/*
            A scrollable region needs to be reachable by keyboard.

            The table is wider than a phone viewport, so this wrapper scrolls.
            A mouse user drags it; a keyboard user could not reach it at all,
            because nothing inside a table of plain text is focusable. Making
            the container itself focusable gives the arrow keys something to
            scroll, and role="region" plus a name is what tells a
            screen-reader user what they have just landed in — an unlabelled
            focus stop is its own kind of confusing.

            It is labelled by the table's caption rather than by the section
            heading above it. The <section> is already a region carrying that
            heading, and two landmarks with one name is a landmark list that
            says "What each report costs" twice and helps nobody.
          */}
          <div
            role="region"
            aria-labelledby="costs-table-caption"
            tabIndex={0}
            className="border-rule focus-visible:ring-cobalt mt-6 overflow-x-auto rounded-[var(--radius-panel)] border focus-visible:ring-2 focus-visible:outline-none"
          >
            <table className="w-full min-w-[640px] border-collapse text-left">
              <caption id="costs-table-caption" className="sr-only">
                Research packages, their token costs and what they include
              </caption>
              <thead>
                <tr className="border-rule bg-ground-raised border-b">
                  <th scope="col" className="text-text px-5 py-3 text-sm font-semibold">
                    Package
                  </th>
                  <th scope="col" className="text-text px-5 py-3 text-sm font-semibold">
                    {BRAND.currency.shortName}
                  </th>
                  <th scope="col" className="text-text px-5 py-3 text-sm font-semibold">
                    Results
                  </th>
                  <th scope="col" className="text-text px-5 py-3 text-sm font-semibold">
                    Typical time
                  </th>
                </tr>
              </thead>
              <tbody>
                {PACKAGE_LIST.map((pkg) => (
                  <tr key={pkg.id} className="border-rule border-b last:border-0">
                    <th scope="row" className="px-5 py-4 align-top">
                      <span className="text-text block text-sm font-semibold">
                        {pkg.name}
                      </span>
                      <span className="text-text-subtle mt-1 block text-sm leading-relaxed font-normal">
                        {pkg.summary}
                      </span>
                    </th>
                    <td className="text-text px-5 py-4 align-top text-sm font-semibold tabular-nums">
                      {formatTokens(pkg.tokenCost)}
                    </td>
                    <td className="text-text-muted px-5 py-4 align-top text-sm">
                      {[
                        pkg.limits.maxCompetitors > 0 &&
                          `${pkg.limits.maxCompetitors} competitors`,
                        pkg.limits.maxLeads > 0 && `${pkg.limits.maxLeads} leads`,
                        pkg.limits.maxInfluencers > 0 &&
                          `${pkg.limits.maxInfluencers} creators`,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </td>
                    <td className="text-text-muted px-5 py-4 align-top text-sm tabular-nums">
                      {pkg.typicalDurationMinutes[0]}–{pkg.typicalDurationMinutes[1]} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        <section aria-labelledby="faq-heading" className="mt-16 max-w-[70ch]">
          <h2
            id="faq-heading"
            className="text-text text-[22px] font-semibold tracking-[var(--tracking-tight)]"
          >
            Questions
          </h2>

          <dl className="mt-6 space-y-6">
            <Faq q={`What exactly is a ${BRAND.currency.singular}?`}>
              A service credit. One balance on your account, spent to run reports. Not
              cryptocurrency, not the AI provider&rsquo;s tokens, and not convertible back
              into money.
            </Faq>

            <Faq q="What happens if a report fails?">
              If it fails on our side — a provider outage, a timeout, output we could not
              validate — the {BRAND.currency.plural} return to your balance automatically,
              and the refund shows in your wallet history. A report that completes
              honestly with stated limitations is a completed report and is not refunded.
            </Faq>

            <Faq q="What if you cannot find much about my market?">
              We tell you. Coverage varies enormously by market, language and industry,
              and some sectors are barely documented publicly. If there is too little to
              build a report we would stand behind, we stop and return your{' '}
              {BRAND.currency.plural} rather than padding it out.
            </Faq>

            <Faq q="Do I get charged twice if I run the same research again?">
              No. An identical brief within {24} hours returns the report you already
              have, free, clearly marked as a cached result.
            </Faq>

            <Faq q="When can I actually buy tokens?">
              Not yet. No payment provider is connected, and nothing on this page will
              take your money. The prices above are provisional.
            </Faq>
          </dl>
        </section>

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="notes-heading"
          className="border-rule bg-ground-raised mt-16 rounded-[var(--radius-panel)] border p-6"
        >
          <h2 id="notes-heading" className="text-text text-sm font-semibold">
            The small print, in plain words
          </h2>
          <ul className="mt-3 space-y-2">
            {PRICING_NOTES.map((note) => (
              <li key={note} className="text-text-muted text-sm leading-relaxed">
                {note}
              </li>
            ))}
          </ul>
          <Link
            href="/terms"
            className="text-cobalt hover:text-cobalt focus-visible:ring-cobalt mt-4 inline-block rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Full terms
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-text text-base font-semibold">{q}</dt>
      <dd className="text-text-muted mt-1.5 leading-relaxed">{children}</dd>
    </div>
  );
}
