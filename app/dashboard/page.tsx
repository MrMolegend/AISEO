import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getMembership } from '@/lib/auth/membership';
import { ROLE_LABEL } from '@/schemas/team';
import { NetworkMotif } from '@/components/motion/network-motif';

export const metadata: Metadata = {
  title: pageTitle('Command Center'),
  robots: { index: false, follow: false },
};

/**
 * The Command Center.
 *
 * The member's operational front page. It grows with the workspace: as the
 * lead, campaign, pipeline and task domains land, their needs-attention
 * queues surface here in priority order. Sections render only when they have
 * something true to say — an empty workspace gets first steps for the
 * member's role, not a grid of zeroes.
 */
export default async function CommandCenterPage() {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath('/dashboard'));

  const membership = await getMembership();
  if (!membership) redirect('/request-access');

  const { member } = membership;
  const isManager = member.role === 'super_admin' || member.role === 'sales_manager';

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[var(--container-page)] flex-1 px-5 pt-10 pb-16 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Meta>Command Center</Meta>
            <h1 className="font-display text-text mt-2 text-3xl font-medium tracking-tight md:text-4xl">
              {member.displayName}
            </h1>
            <p className="text-text-muted mt-2 text-[14px]">
              {ROLE_LABEL[member.role]}
              {member.territories.length > 0 ? ` — ${member.territories.join(', ')}` : ''}
            </p>
          </div>
          <div className="flex flex-col items-end gap-4">
            <NetworkMotif className="hidden h-16 w-48 opacity-80 md:block" />
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/campaigns">Campaigns</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/leads">Lead explorer</Link>
              </Button>
            </div>
          </div>
        </header>

        <Rule label="First steps" className="mt-12" />
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {isManager && (
            <StepCard
              step="01"
              title="Confirm the commercial profile"
              body="Territories, segments, the brand catalogue and approved proof points drive discovery and outreach. Facts seeded from the build carry their source and date — review them before the first campaign."
              href="/commercial"
              cta="Commercial configuration"
            />
          )}
          <StepCard
            step={isManager ? '02' : '01'}
            title="Define an ideal customer profile"
            body="Territory, segment, category mix and evidence bar — a reusable description of the accounts worth finding."
            href="/icps"
            cta="Ideal customer profiles"
          />
          <StepCard
            step={isManager ? '03' : '02'}
            title="Run a discovery campaign"
            body="Bounded, evidence-led research with a cost preview before anything spends. Candidates arrive with sources attached, never invented."
            href="/campaigns"
            cta="Campaigns"
          />
        </div>

        <Rule label="Needs attention" className="mt-14" />
        <Panel className="mt-6 p-8">
          <p className="text-text-muted text-[14px] leading-relaxed">
            Nothing needs attention yet. As campaigns run, this section fills with
            priority leads, warm paths awaiting confirmation, overdue next actions and
            research that has finished or stalled.
          </p>
        </Panel>
      </main>

      <SiteFooter />
    </div>
  );
}

function StepCard({
  step,
  title,
  body,
  href,
  cta,
}: {
  step: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Panel className="flex flex-col p-6">
      <Meta data-numeric>Step {step}</Meta>
      <h2 className="font-display text-text mt-2 text-xl font-medium">{title}</h2>
      <p className="text-text-muted mt-3 flex-1 text-[14px] leading-relaxed">{body}</p>
      <div className="mt-5">
        <Button asChild variant="secondary" size="sm">
          <Link href={href}>{cta}</Link>
        </Button>
      </div>
    </Panel>
  );
}
