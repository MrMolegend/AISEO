import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getTokenWallet } from '@/lib/tokens';
import { BRAND, pageTitle } from '@/config/brand';
import { creditsFrom } from '@/config/report';

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
  title: pageTitle('Account'),
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/account'));

  const [store, wallet] = await Promise.all([getResearchJobStore(), getTokenWallet()]);
  const [jobs, balance] = await Promise.all([
    store.listForUser(user.id, 100),
    wallet.getBalance(user.id),
  ]);
  const oldest = jobs.at(-1);
  const credits = creditsFrom(balance.available);

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-narrow)] px-5 py-12 md:px-8 md:py-16"
      >
        <Meta>Account</Meta>
        <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[38px]">
          {user.email ?? 'Your account'}
        </h1>

        <Panel edge="signal" className="mt-8">
          <div className="p-6">
            <Meta>Beta access</Meta>
            <p
              className="font-display text-text mt-2 text-[36px] leading-none"
              data-numeric
            >
              {credits}
            </p>
            <p className="text-text-muted mt-2 text-[14px]">
              {credits === 1 ? BRAND.credit.singular : BRAND.credit.plural} remaining
            </p>
            <p className="text-text-subtle mt-4 text-[13px] leading-relaxed">
              One assessment costs one {BRAND.credit.singular}, and it is only spent once
              a report has passed our evidence checks. During the beta there is nothing to
              buy — credits are granted manually. Write to {BRAND.supportEmail} if you
              need more.
            </p>
          </div>
        </Panel>

        <section aria-labelledby="details-heading" className="mt-12">
          <h2 id="details-heading" className="sr-only">
            Account details
          </h2>
          <Rule label="Details" />
          <dl className="mt-4 space-y-4">
            <Field label="Email">
              <span className="text-text break-all">{user.email ?? 'Not available'}</span>
            </Field>
            <Field label="Assessments run">
              <span className="text-text" data-numeric>
                {jobs.length}
              </span>
            </Field>
            {oldest && (
              <Field label="First assessment">
                <time className="text-text" dateTime={oldest.createdAt} data-numeric>
                  {oldest.createdAt.slice(0, 10)}
                </time>
              </Field>
            )}
          </dl>
        </section>

        <section aria-labelledby="data-heading" className="mt-12">
          <h2 id="data-heading" className="sr-only">
            Your data
          </h2>
          <Rule label="Your data" />
          <div className="text-text-muted mt-4 space-y-3 text-[14px] leading-relaxed">
            <p>
              We hold the briefs you submitted, the reports produced from them, the
              sources behind those reports, and your account&rsquo;s credit history. We do
              not store raw IP addresses; rate limiting uses a salted hash that cannot be
              reversed back to an address.
            </p>
            <p>
              Your password is managed by our authentication provider and is never stored
              by this application in any form.
            </p>
            <p>
              Deleting your account removes your profile, your credit history and every
              assessment. It cannot be undone, and shared report links stop working
              immediately. Write to {BRAND.supportEmail} and we will do it.
            </p>
          </div>
        </section>

        <div className="border-rule mt-12 border-t pt-8">
          <SignOutButton />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-6">
      <dt className="sm:w-44 sm:shrink-0">
        <Meta>{label}</Meta>
      </dt>
      <dd className="text-[15px]">{children}</dd>
    </div>
  );
}
