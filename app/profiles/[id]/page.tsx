import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ProfileForm, toProfileFormValues } from '@/components/profiles/profile-form';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getBusinessProfileStore } from '@/lib/profiles/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Edit business profile'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

export default async function EditProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/profiles'));

  const { id } = await params;
  const store = await getBusinessProfileStore();
  // Owner-filtered read: someone else's profile id is a 404, not a leak.
  const profile = await store.getForUser(id, user.id).catch(() => null);
  if (!profile) notFound();

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-narrow)] px-5 py-12 md:py-16"
      >
        <Meta>Edit business profile</Meta>
        <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[40px]">
          {profile.name}
        </h1>
        <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
          Changes apply to future assessments. Reports already produced keep the brief
          they were produced from.
        </p>

        <div className="mt-10">
          <ProfileForm
            profileId={profile.id}
            initialValues={toProfileFormValues(profile)}
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
