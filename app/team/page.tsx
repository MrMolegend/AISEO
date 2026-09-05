import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Meta } from '@/components/ui/panel';
import { TeamManager } from '@/components/team/team-manager';
import { pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getMembership } from '@/lib/auth/membership';
import { getTeamStore } from '@/lib/team/store';

export const metadata: Metadata = {
  title: pageTitle('Team'),
  robots: { index: false, follow: false },
};

/**
 * Team management.
 *
 * Managers see the roster; only super_admin gets the invite and edit
 * controls. Everyone else gets the same 404 a mistyped URL would earn —
 * the page never confirms its own existence to someone outside it.
 */
export default async function TeamPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/team'));

  const membership = await getMembership();
  if (!membership) redirect('/request-access');

  const role = membership.member.role;
  if (role !== 'super_admin' && role !== 'sales_manager') notFound();

  const store = await getTeamStore();
  const members = await store.list();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[var(--container-page)] flex-1 px-5 pt-10 pb-16 md:px-8">
        <header>
          <Meta>Team</Meta>
          <h1 className="font-display text-text mt-2 text-3xl font-medium tracking-tight md:text-4xl">
            Who can enter, and as what.
          </h1>
          <p className="text-text-muted mt-3 max-w-2xl text-[15px] leading-relaxed">
            Membership is the only door into this workspace. Role changes apply on the
            member&rsquo;s next request; revocation removes access immediately and keeps
            their name on everything they did.
          </p>
        </header>

        <div className="mt-10">
          <TeamManager
            members={members.map((member) => ({
              userId: member.userId,
              role: member.role,
              displayName: member.displayName,
              territories: member.territories,
              status: member.status,
            }))}
            selfId={user.id}
            canInvite={role === 'super_admin'}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
