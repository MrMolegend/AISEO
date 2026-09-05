import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ProfileForm } from '@/components/profiles/profile-form';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('New business profile'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

export default async function NewProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/profiles/new'));

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-narrow)] px-5 py-12 md:py-16"
      >
        <Meta>New business profile</Meta>
        <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[40px]">
          Describe the business once.
        </h1>
        <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
          Everything here is reusable context for future assessments, and everything
          except the name is optional — including the website.
        </p>

        <div className="mt-10">
          <ProfileForm />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
