import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { FlashNotice } from '@/components/layout/flash-notice';
import { SiteFooter } from '@/components/layout/site-footer';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser } from '@/lib/auth/server';
import { getMembership } from '@/lib/auth/membership';

export const metadata: Metadata = {
  title: pageTitle(),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * The gateway.
 *
 * This is an internal tool, so the root page markets nothing. A member is
 * taken straight to their Command Center; a signed-in visitor without
 * membership is routed to the request-access holding page; everyone else
 * sees the wordmark, one sentence of purpose, and the way in.
 */
export default async function GatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ 'signed-out'?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    const membership = await getMembership();
    redirect(membership ? '/dashboard' : '/request-access');
  }

  const signedOut = Boolean((await searchParams)['signed-out']);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {signedOut && (
        <div className="mx-auto w-full max-w-[var(--container-page)] px-5 pt-8 md:px-8">
          <FlashNotice kind="signed-out" />
        </div>
      )}

      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-[var(--container-page)] px-5 py-20 md:px-8">
          <div className="max-w-2xl">
            <Meta>{BRAND.legalEntity} — internal platform</Meta>
            <h1 className="font-display text-text mt-4 text-4xl leading-[1.05] font-medium tracking-tight md:text-6xl">
              {BRAND.name}
            </h1>
            <p className="text-text-muted mt-3 text-lg md:text-xl">{BRAND.tagline}</p>
            <p className="text-text-muted mt-6 max-w-xl text-[15px] leading-relaxed">
              Evidence-led wholesale lead discovery, relationship mapping and grounded
              outreach for the ALT team, across the UAE and GCC. Access is by invitation
              from an administrator.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Button asChild size="lg">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <p className="text-text-subtle text-[13px]">
                No account? Ask your ALT administrator for an invitation.
              </p>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
