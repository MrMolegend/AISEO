import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Card, CardBody } from '@/components/ui/card';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { BRAND, pageTitle } from '@/config/brand';

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

  const store = await getResearchJobStore();
  const jobs = await store.listForUser(user.id, 100);
  const oldest = jobs.at(-1);

  return (
    <>
      <SiteHeader />

      <main id="main" className="mx-auto max-w-[720px] px-5 py-12 md:px-8">
        <h1 className="text-text text-[30px] font-semibold tracking-[var(--tracking-display)]">
          Account
        </h1>

        <Card className="mt-8">
          <CardBody>
            <dl className="space-y-5">
              <Field label="Email">
                <span className="text-text break-all">
                  {user.email ?? 'Not available'}
                </span>
              </Field>

              <Field label="Reports run">
                <span className="text-text tabular-nums">{jobs.length}</span>
              </Field>

              {oldest && (
                <Field label="First report">
                  <time className="text-text tabular-nums" dateTime={oldest.createdAt}>
                    {new Date(oldest.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </time>
                </Field>
              )}
            </dl>
          </CardBody>
        </Card>

        {/* ── Privacy ───────────────────────────────────────────────────── */}
        <section aria-labelledby="privacy-heading" className="mt-10">
          <h2
            id="privacy-heading"
            className="text-text text-[20px] font-semibold tracking-[var(--tracking-tight)]"
          >
            Your data
          </h2>

          <Card className="mt-4">
            <CardBody className="space-y-4 text-sm leading-relaxed">
              <p className="text-text-muted">
                Your reports are private to your account. A report is only visible to
                someone else if you share its link — those links are long and random, and
                report pages are never indexed by search engines.
              </p>
              <p className="text-text-muted">
                We store what you typed into each brief, the public pages we read, and
                your {BRAND.currency.name} history. We do not store raw IP addresses;
                where we need to recognise a location for rate limiting we store a salted
                hash instead.
              </p>
              <p className="text-text-muted">
                Deleting your account removes your profile, wallet,{' '}
                {BRAND.currency.plural} history and every report. It cannot be undone, and
                it is not something this page can do yet — email{' '}
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="text-cobalt focus-visible:ring-cobalt rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {BRAND.supportEmail}
                </a>{' '}
                and we will do it by hand.
              </p>

              <p className="text-text-subtle">
                <Link
                  href="/privacy"
                  className="text-cobalt focus-visible:ring-cobalt rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
                >
                  Full privacy policy
                </Link>
              </p>
            </CardBody>
          </Card>
        </section>

        <div className="mt-10">
          <SignOutButton />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
      <dt className="text-text-subtle w-32 shrink-0 text-sm font-medium">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
