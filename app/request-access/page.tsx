import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Panel, Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getMembership } from '@/lib/auth/membership';

export const metadata: Metadata = {
  title: pageTitle('Request access'),
  robots: { index: false, follow: false },
};

/**
 * The holding page for a signed-in account without membership.
 *
 * Having a Supabase account is not membership: this workspace is
 * invitation-only, and membership rows are created by an administrator.
 * The page says exactly that — no feature list, no partial navigation, no
 * hint of what exists inside. The account's email is shown so the person
 * can quote it to the administrator who will invite them.
 */
export default async function RequestAccessPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/request-access'));

  const membership = await getMembership();
  if (membership) redirect('/dashboard');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-[var(--container-page)] px-5 py-20 md:px-8">
          <div className="mx-auto max-w-xl">
            <Panel className="p-8">
              <Meta>{BRAND.name}</Meta>
              <h1 className="font-display text-text mt-3 text-2xl font-medium">
                This workspace is invitation-only.
              </h1>
              <p className="text-text-muted mt-4 text-[15px] leading-relaxed">
                You are signed in, but this account has not been added to the{' '}
                {BRAND.legalEntity} team. An administrator can add you from the Team page;
                once they have, this page will take you straight to your Command Center.
              </p>
              <p className="text-text-muted mt-4 text-[15px] leading-relaxed">
                Quote this address when you ask:{' '}
                <span className="text-text font-medium">
                  {user.email ?? 'your sign-in email'}
                </span>
              </p>
            </Panel>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
