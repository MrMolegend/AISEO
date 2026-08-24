import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ResearchForm } from '@/components/research/forms/research-form';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { getPackage, isResearchPackageId } from '@/config/packages';
import { pageTitle } from '@/config/brand';

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

export default async function PackageFormPage({
  params,
}: {
  params: Promise<{ packageId: string }>;
}) {
  const { packageId } = await params;
  if (!isResearchPackageId(packageId)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(signInPath(`/research/new/${packageId}`));

  const pkg = getPackage(packageId);
  if (!pkg.enabled) notFound();

  const wallet = await getTokenWallet();
  const balance = await wallet.getBalance(user.id);

  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[760px] px-5 py-12 md:px-8">
        <Link
          href="/research/new"
          className="text-ink-subtle hover:text-ink focus-visible:ring-brand inline-flex items-center gap-1.5 rounded text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span aria-hidden="true">←</span> All packages
        </Link>

        <h1 className="text-ink mt-6 text-[30px] leading-tight font-semibold tracking-[var(--tracking-display)]">
          {pkg.name}
        </h1>
        <p className="text-ink-muted mt-3 max-w-[62ch] leading-relaxed">
          {pkg.description}
        </p>

        <div className="mt-10">
          <ResearchForm packageId={packageId} available={balance.available} />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
