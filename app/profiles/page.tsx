import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { ProfileCard } from '@/components/profiles/profile-card';
import { Button } from '@/components/ui/button';
import { Panel, Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getBusinessProfileStore } from '@/lib/profiles/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Business profiles'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * The profile shelf.
 *
 * A returning customer's starting point: each profile is a business they can
 * assess against a new market without re-typing what the business is. Live
 * profiles lead; archived ones sit below, restorable, because "archived"
 * that cannot be undone is just "deleted" with better manners.
 */
export default async function ProfilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/profiles'));

  const store = await getBusinessProfileStore();
  const profiles = await store.listForUser(user.id, { includeArchived: true });
  const live = profiles.filter((profile) => profile.archivedAt === null);
  const archived = profiles.filter((profile) => profile.archivedAt !== null);

  return (
    <>
      <SiteHeader />

      <main
        id="main"
        className="mx-auto max-w-[var(--container-content)] px-5 py-12 md:py-16"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Meta>Business profiles</Meta>
            <h1 className="font-display text-text mt-3 text-[32px] leading-tight md:text-[40px]">
              What you sell, on file.
            </h1>
            <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
              A profile describes the business once, so every new assessment starts
              prefilled instead of blank. A website is optional throughout — describe what
              you sell and the research takes it from there.
            </p>
          </div>
          <Button asChild>
            <Link href="/profiles/new">New profile</Link>
          </Button>
        </div>

        {live.length === 0 && archived.length === 0 ? (
          <Panel className="mt-10">
            <div className="p-8 text-center">
              <p className="text-text text-[15px]">No profiles yet.</p>
              <p className="text-text-muted measure mx-auto mt-2 text-[14px] leading-relaxed">
                Create one for the business you want to take into a new market. It takes a
                couple of minutes, only the name is required, and every assessment you run
                afterwards starts from it.
              </p>
              <Button asChild className="mt-6">
                <Link href="/profiles/new">Create your first profile</Link>
              </Button>
            </div>
          </Panel>
        ) : (
          <>
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
              {live.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>

            {archived.length > 0 && (
              <section aria-labelledby="archived-heading" className="mt-14">
                <h2 id="archived-heading" className="text-text-subtle text-[13px]">
                  Archived
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {archived.map((profile) => (
                    <ProfileCard key={profile.id} profile={profile} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </>
  );
}
