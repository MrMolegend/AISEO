import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { BRAND, pageTitle } from '@/config/brand';
import { PACKAGE_LIST } from '@/config/packages';
import {
  BUNDLE_LIST,
  PURCHASING_ENABLED,
  formatPrice,
  formatTokens,
} from '@/config/tokens';
import type { TransactionType } from '@/lib/tokens/types';

/*
 * Never prerendered.
 *
 * This page's output depends on who is asking. Without this, a build that
 * happens to run without Supabase credentials configured resolves the session
 * to "signed out" and bakes the redirect to sign-in into a static page, which
 * would then be served to signed-in users forever.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Wallet'),
  robots: { index: false, follow: false },
};

/** How each ledger entry reads to a person. */
const TYPE_LABEL: Record<TransactionType, string> = {
  admin_grant: 'Granted',
  welcome_credit: 'Welcome credit',
  reservation: 'Reserved for research',
  debit: 'Spent',
  refund: 'Refunded',
  purchase: 'Purchased',
  adjustment: 'Adjustment',
};

export default async function WalletPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/wallet'));

  const wallet = await getTokenWallet();
  const [balance, history] = await Promise.all([
    wallet.getBalance(user.id),
    wallet.history(user.id, 50),
  ]);

  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[900px] px-5 py-12 md:px-8">
        <h1 className="text-text text-[30px] font-semibold tracking-[var(--tracking-display)]">
          Wallet
        </h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardBody>
              <p className="text-text-subtle text-sm font-medium">Available</p>
              <p className="text-text mt-1 text-[36px] leading-none font-semibold tabular-nums">
                {formatTokens(balance.available)}
              </p>
              <p className="text-text-faint mt-1.5 text-sm">
                {BRAND.currency.plural} you can spend now
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <p className="text-text-subtle text-sm font-medium">Held</p>
              <p className="text-text mt-1 text-[36px] leading-none font-semibold tabular-nums">
                {formatTokens(balance.reserved)}
              </p>
              <p className="text-text-faint mt-1.5 text-sm leading-relaxed">
                {balance.reserved > 0
                  ? 'Reserved against research that is still running. Returned automatically if it fails.'
                  : 'Nothing is being held right now'}
              </p>
            </CardBody>
          </Card>
        </div>

        <p className="text-text-subtle mt-4 text-sm leading-relaxed">
          {BRAND.currency.disclaimer}
        </p>

        {/* ── History ───────────────────────────────────────────────────── */}
        <section aria-labelledby="history-heading" className="mt-12">
          <h2
            id="history-heading"
            className="text-text text-[20px] font-semibold tracking-[var(--tracking-tight)]"
          >
            History
          </h2>

          {history.length === 0 ? (
            <Card className="mt-4">
              <CardBody className="py-10 text-center">
                <p className="text-text-muted">
                  Nothing yet. Every grant, reservation, spend and refund will appear
                  here.
                </p>
              </CardBody>
            </Card>
          ) : (
            <div
              // Same reasoning as the pricing table: see app/pricing/page.tsx.
              role="region"
              aria-labelledby="history-table-caption"
              tabIndex={0}
              className="border-rule focus-visible:ring-cobalt mt-4 overflow-x-auto rounded-[var(--radius-panel)] border focus-visible:ring-2 focus-visible:outline-none"
            >
              <table className="w-full min-w-[560px] border-collapse text-left">
                <caption id="history-table-caption" className="sr-only">
                  Every movement of {BRAND.currency.name} on this account
                </caption>
                <thead>
                  <tr className="border-rule bg-ground-raised border-b">
                    <th scope="col" className="text-text px-4 py-3 text-sm font-semibold">
                      When
                    </th>
                    <th scope="col" className="text-text px-4 py-3 text-sm font-semibold">
                      What
                    </th>
                    <th
                      scope="col"
                      className="text-text px-4 py-3 text-right text-sm font-semibold"
                    >
                      Change
                    </th>
                    <th
                      scope="col"
                      className="text-text px-4 py-3 text-right text-sm font-semibold"
                    >
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-rule border-b last:border-0">
                      <td className="text-text-muted px-4 py-3 align-top text-sm whitespace-nowrap tabular-nums">
                        <time dateTime={entry.createdAt}>
                          {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </time>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-text block text-sm font-medium">
                          {TYPE_LABEL[entry.type]}
                        </span>
                        <span className="text-text-subtle block text-sm leading-relaxed">
                          {entry.description}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-top text-sm tabular-nums">
                        {entry.amount === 0 ? (
                          <span
                            className="text-text-faint"
                            title="Already deducted when it was reserved"
                          >
                            —
                          </span>
                        ) : (
                          <span
                            className={
                              entry.amount > 0
                                ? 'font-medium text-[var(--color-verdict-promising)]'
                                : 'text-text font-medium'
                            }
                          >
                            {entry.amount > 0 ? '+' : ''}
                            {formatTokens(entry.amount)}
                          </span>
                        )}
                      </td>
                      <td className="text-text-muted px-4 py-3 text-right align-top text-sm tabular-nums">
                        {formatTokens(entry.balanceAfter)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Costs and bundles ─────────────────────────────────────────── */}
        <section aria-labelledby="costs-heading" className="mt-12">
          <h2
            id="costs-heading"
            className="text-text text-[20px] font-semibold tracking-[var(--tracking-tight)]"
          >
            What things cost
          </h2>

          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {PACKAGE_LIST.map((pkg) => (
              <li
                key={pkg.id}
                className="border-rule bg-ground-raised flex items-center justify-between rounded-[var(--radius-control)] border px-4 py-3"
              >
                <span className="text-text text-sm">{pkg.name}</span>
                <span className="text-text text-sm font-semibold tabular-nums">
                  {formatTokens(pkg.tokenCost)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="topup-heading"
          className="border-rule bg-ground-raised mt-8 rounded-[var(--radius-panel)] border p-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="topup-heading" className="text-text text-base font-semibold">
              Adding {BRAND.currency.plural}
            </h2>
            {!PURCHASING_ENABLED && (
              <Badge tone="neutral" size="sm">
                Coming soon
              </Badge>
            )}
          </div>

          <p className="text-text-muted mt-2 text-sm leading-relaxed">
            No payment provider is connected yet, so bundles cannot be bought. These are
            the provisional prices.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {BUNDLE_LIST.map((bundle) => (
              <div
                key={bundle.id}
                className="border-rule bg-ground-raised rounded-[var(--radius-control)] border px-3 py-2.5"
              >
                <p className="text-text-subtle text-xs">{bundle.name}</p>
                <p className="text-text text-sm font-semibold tabular-nums">
                  {formatTokens(bundle.tokens)}
                </p>
                <p className="text-text-muted text-xs tabular-nums">
                  {formatPrice(bundle.priceMinorUnits)}
                </p>
              </div>
            ))}
          </div>

          <Link
            href="/pricing"
            className="text-cobalt hover:text-cobalt focus-visible:ring-cobalt mt-4 inline-block rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Pricing details
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
