import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PackageCard } from '@/components/marketing/package-card';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BRAND, pageTitle } from '@/config/brand';
import { PACKAGE_LIST } from '@/config/packages';
import {
  BUNDLE_LIST,
  formatPrice,
  formatTokens,
  PURCHASING_ENABLED,
} from '@/config/tokens';
import { getCurrentUser } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: pageTitle(),
  description: BRAND.description,
  alternates: { canonical: '/' },
};

export default async function LandingPage() {
  const user = await getCurrentUser();
  const startHref = user ? '/research/new' : '/sign-in?next=%2Fresearch%2Fnew';

  return (
    <>
      <SiteHeader />

      <main id="main">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-[1240px] px-5 pt-16 pb-4 md:px-8 md:pt-24">
          <div className="max-w-[720px]">
            <h1 className="text-ink text-[38px] leading-[1.1] font-semibold tracking-[var(--tracking-display)] md:text-[52px]">
              {BRAND.tagline}
            </h1>
            <p className="text-ink-muted mt-5 max-w-[60ch] text-lg leading-relaxed">
              {BRAND.description}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={startHref}
                className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand inline-flex h-14 items-center rounded-[var(--radius-control)] px-7 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Start a report
              </Link>
              <Link
                href="/pricing"
                className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-14 items-center rounded-[var(--radius-control)] border px-7 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                See pricing
              </Link>
            </div>
          </div>
        </section>

        {/* ── What makes it different ───────────────────────────────────── */}
        <section className="mx-auto max-w-[1240px] px-5 py-16 md:px-8 md:py-20">
          <div className="grid gap-5 md:grid-cols-3">
            <Card>
              <CardBody>
                <h2 className="text-ink text-base font-semibold">Every claim is cited</h2>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  Each factual statement carries a numbered link to the page it came from.
                  If a claim has no source, it does not go in the report — a validator
                  rejects it before you ever see it.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-ink text-base font-semibold">Nothing is invented</h2>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  Prices, follower counts and company sizes are either published somewhere
                  we could read, or marked as unavailable. We would rather show you a gap
                  than an estimate you might quote in a meeting.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h2 className="text-ink text-base font-semibold">
                  It tells you what it missed
                </h2>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  Every report has a limitations section, and it is honest. Some markets
                  are thinly documented, and a report that admits that is worth more than
                  one that pads the gap.
                </p>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* ── Packages ──────────────────────────────────────────────────── */}
        <section
          aria-labelledby="packages-heading"
          className="mx-auto max-w-[1240px] px-5 pb-16 md:px-8 md:pb-20"
        >
          <h2
            id="packages-heading"
            className="text-ink text-[26px] font-semibold tracking-[var(--tracking-tight)]"
          >
            Research packages
          </h2>
          <p className="text-ink-muted mt-2 max-w-[62ch] leading-relaxed">
            Choose what you need. Each one spends {BRAND.currency.name} from your balance.
          </p>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {PACKAGE_LIST.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                href={
                  user ? `/research/new/${pkg.id}` : '/sign-in?next=%2Fresearch%2Fnew'
                }
                featured={pkg.id === 'market-pack'}
              />
            ))}
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section
          aria-labelledby="how-heading"
          className="border-line bg-surface-subtle border-y"
        >
          <div className="mx-auto max-w-[1240px] px-5 py-16 md:px-8 md:py-20">
            <h2
              id="how-heading"
              className="text-ink text-[26px] font-semibold tracking-[var(--tracking-tight)]"
            >
              How it works
            </h2>

            <ol className="mt-8 grid gap-6 md:grid-cols-4">
              {[
                {
                  title: 'Tell us about your business',
                  body: 'Your website, your market, and what you sell. Two minutes of typing.',
                },
                {
                  title: 'We read the public record',
                  body: 'Your own site first, then public sources about your market — bounded, and respecting robots.txt.',
                },
                {
                  title: 'We check every claim',
                  body: 'Citations are validated against the sources we actually read. Anything unattributable is rejected.',
                },
                {
                  title: 'You get a report to keep',
                  body: 'A permanent link, a CSV export, and a page you can share with your team.',
                },
              ].map((step, index) => (
                <li key={step.title}>
                  <span
                    aria-hidden="true"
                    className="text-brand block text-sm font-semibold tabular-nums"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-ink mt-2 text-base font-semibold">{step.title}</h3>
                  <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Tokens ────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="tokens-heading"
          className="mx-auto max-w-[1240px] px-5 py-16 md:px-8 md:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <h2
                id="tokens-heading"
                className="text-ink text-[26px] font-semibold tracking-[var(--tracking-tight)]"
              >
                {BRAND.currency.name}
              </h2>
              <p className="text-ink-muted mt-3 leading-relaxed">
                One balance, spent on whichever reports you need. A report that fails on
                our side returns its {BRAND.currency.plural} automatically.
              </p>
              <p className="text-ink-subtle mt-4 text-sm leading-relaxed">
                {BRAND.currency.disclaimer}
              </p>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-ink text-sm font-semibold">Provisional bundles</h3>
                {!PURCHASING_ENABLED && (
                  <Badge tone="neutral" size="sm">
                    Coming soon
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {BUNDLE_LIST.map((bundle) => (
                  <Card key={bundle.id}>
                    <CardBody className="p-4">
                      <p className="text-ink-subtle text-xs font-medium">{bundle.name}</p>
                      <p className="text-ink mt-1 text-lg font-semibold tabular-nums">
                        {formatTokens(bundle.tokens)}
                      </p>
                      <p className="text-ink-muted text-sm tabular-nums">
                        {formatPrice(bundle.priceMinorUnits)}
                      </p>
                    </CardBody>
                  </Card>
                ))}
              </div>

              <Link
                href="/pricing"
                className="text-brand hover:text-brand-hover focus-visible:ring-brand mt-4 inline-block rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Full pricing and package costs
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
