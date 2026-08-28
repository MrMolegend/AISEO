import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { PackageCard } from '@/components/marketing/package-card';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { PACKAGE_LIST } from '@/config/packages';
import { BRAND, pageTitle } from '@/config/brand';
import { formatTokens } from '@/config/tokens';

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
  title: pageTitle('New research'),
  robots: { index: false, follow: false },
};

export default async function NewResearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/research/new'));

  const wallet = await getTokenWallet();
  const balance = await wallet.getBalance(user.id);

  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
        <h1 className="text-text text-[30px] font-semibold tracking-[var(--tracking-display)]">
          What would you like to know?
        </h1>
        <p className="text-text-muted mt-2 tabular-nums">
          {formatTokens(balance.available)} {BRAND.currency.plural} available
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {PACKAGE_LIST.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              href={`/research/new/${pkg.id}`}
              balance={balance.available}
              featured={pkg.id === 'market-pack'}
            />
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
