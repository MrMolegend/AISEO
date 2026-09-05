import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { OwnerToolbar } from '@/components/dossier/owner-toolbar';
import { ActionWorkspace } from '@/components/actions/action-workspace';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { countryName } from '@/config/markets';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getActionItemStore } from '@/lib/actions/store';
import { toWorkspaceActions } from '@/lib/actions/serialize';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Report actions'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

/**
 * One report's slice of the action workspace, with the import affordance.
 * The full cross-report workspace lives at /actions.
 */
export default async function ReportActionsPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(`/research/${publicId}/actions`));

  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, user.id);
  if (!job || job.status !== 'complete' || job.packageId !== 'market-entry') notFound();

  const actionStore = await getActionItemStore();
  const actions = await toWorkspaceActions(
    user.id,
    await actionStore.listForUser(user.id, { jobId: job.id }),
  );

  const target = (job.report as { decision?: { targetCountry?: string } } | null)
    ?.decision?.targetCountry;

  return (
    <>
      <SiteHeader />
      <main id="main">
        <OwnerToolbar publicId={publicId} active="actions" />

        <div className="mx-auto max-w-[var(--container-content)] px-5 py-10 md:px-8">
          <Meta>Report actions</Meta>
          <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[38px]">
            {job.subjectName}
            {target ? ` — ${countryName(target)}` : ''}
          </h1>
          <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
            The 30/60/90 recommendations from this report, as editable actions. Your full
            workspace across every report is at{' '}
            <Link
              href="/actions"
              className="text-cobalt underline-offset-4 hover:underline"
            >
              Actions
            </Link>
            .
          </p>

          <div className="mt-10">
            <ActionWorkspace
              initialActions={actions}
              importFrom={{ publicId, alreadyImported: actions.length > 0 }}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
