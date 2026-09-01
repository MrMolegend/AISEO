import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { DataTable, Th, Td } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { BRAND, pageTitle } from '@/config/brand';
import { REPORT_TOKEN_COST, creditsFrom } from '@/config/report';
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
  title: pageTitle('Credit history'),
  robots: { index: false, follow: false },
};

/**
 * Credit history.
 *
 * Deliberately not in the navigation. There is nothing to buy during the beta,
 * so a wallet in the main menu would be a shop with no shelves — it is reached
 * from the account page by someone who wants to check what happened to a
 * credit, which is the only question it answers.
 *
 * The purchasing catalogue and the bundle pricing are gone from this page but
 * not from the codebase: the ledger, the grant path and the accounting behind
 * them are intact and unchanged, so wiring a payment provider later is a
 * checkout in front of machinery that already works.
 *
 * Everything is expressed in report credits. The underlying ledger counts
 * tokens and always has; the conversion happens here so no token figure reaches
 * the page.
 */
const TYPE_LABEL: Record<TransactionType, string> = {
  admin_grant: 'Granted',
  welcome_credit: 'Welcome credit',
  reservation: 'Reserved for an assessment',
  debit: 'Spent on a completed report',
  refund: 'Returned',
  purchase: 'Purchased',
  adjustment: 'Adjustment',
};

export default async function CreditHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/wallet'));

  const wallet = await getTokenWallet();
  const [balance, history] = await Promise.all([
    wallet.getBalance(user.id),
    wallet.history(user.id, 50),
  ]);

  const available = creditsFrom(balance.available);
  const held = creditsFrom(balance.reserved);

  /**
   * A ledger row, in credits.
   *
   * Amounts smaller than one report are shown as a dash rather than as "0",
   * because a row reading "0 credits" next to a real movement looks like a bug
   * rather than like an adjustment below the resolution of a credit.
   */
  const asCredits = (amount: number): string => {
    if (amount === 0) return '—';
    const credits = Math.round((Math.abs(amount) / REPORT_TOKEN_COST) * 10) / 10;
    if (credits === 0) return '—';
    return `${amount > 0 ? '+' : '−'}${credits}`;
  };

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-narrow)] px-5 py-12 md:px-8 md:py-16"
      >
        <Meta>Account</Meta>
        <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[38px]">
          Credit history
        </h1>

        <div className="mt-8 grid gap-px sm:grid-cols-2">
          <Panel>
            <div className="p-5">
              <Meta>Available</Meta>
              <p
                className="font-display text-text mt-2 text-[36px] leading-none"
                data-numeric
              >
                {available}
              </p>
              <p className="text-text-muted mt-2 text-[13px]">
                {available === 1 ? BRAND.credit.singular : BRAND.credit.plural} you can
                use now
              </p>
            </div>
          </Panel>
          <Panel>
            <div className="p-5">
              <Meta>Held</Meta>
              <p
                className="font-display text-text mt-2 text-[36px] leading-none"
                data-numeric
              >
                {held}
              </p>
              <p className="text-text-muted mt-2 text-[13px] leading-relaxed">
                {balance.reserved > 0
                  ? 'Reserved against an assessment that is still running. Returned automatically if it cannot be completed.'
                  : 'Nothing is being held right now'}
              </p>
            </div>
          </Panel>
        </div>

        <section aria-labelledby="history-heading" className="mt-12">
          <h2 id="history-heading" className="sr-only">
            Movements
          </h2>
          <Rule label="Movements" />

          {history.length === 0 ? (
            <p className="text-text-faint mt-4 text-[14px]">Nothing has moved yet.</p>
          ) : (
            <div className="mt-4">
              <DataTable
                caption="Every movement of report credits on this account"
                captionId="history-caption"
                minWidth={520}
              >
                <thead>
                  <tr>
                    <Th scope="col">When</Th>
                    <Th scope="col">What</Th>
                    <Th scope="col">Change</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <Td data-numeric className="whitespace-nowrap">
                        <time dateTime={entry.createdAt}>
                          {entry.createdAt.slice(0, 10)}
                        </time>
                      </Td>
                      <Td>
                        <span className="text-text">{TYPE_LABEL[entry.type]}</span>
                        {entry.type === 'refund' && (
                          <Badge tone="signal" size="sm" className="ml-2">
                            automatic
                          </Badge>
                        )}
                      </Td>
                      <Td data-numeric className="whitespace-nowrap">
                        {asCredits(entry.amount)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          )}
        </section>

        <p className="text-text-subtle mt-10 text-[13px] leading-relaxed">
          {BRAND.credit.disclaimer} There is nothing to buy during the beta — credits are
          granted manually. Write to {BRAND.supportEmail} if you need more.
        </p>

        <p className="mt-8">
          <Link
            href="/account"
            className="text-cobalt text-[14px] underline-offset-4 hover:underline"
          >
            Back to your account
          </Link>
        </p>
      </main>

      <SiteFooter />
    </>
  );
}
