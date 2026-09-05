import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { OwnerToolbar } from '@/components/dossier/owner-toolbar';
import { ShareManager } from '@/components/dossier/share-manager';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { getCurrentUser, signInPath } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getShareLinkStore } from '@/lib/share/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Sharing'),
  description: BRAND.description,
  robots: { index: false, follow: false },
};

export default async function SharingPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(`/research/${publicId}/sharing`));

  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, user.id);
  if (!job || job.status !== 'complete') notFound();

  const shares = await (await getShareLinkStore()).listForJob(user.id, job.id);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <OwnerToolbar publicId={publicId} active="sharing" />

        <div className="mx-auto max-w-[var(--container-content)] px-5 py-10 md:px-8">
          <Meta>Sharing</Meta>
          <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[38px]">
            Who can read {job.subjectName}.
          </h1>
          <p className="text-text-muted measure mt-3 text-[15px] leading-relaxed">
            This report is private to you. Sharing mints a separate link a recipient can
            open without an account — each one revocable, optionally expiring, and
            counted. Recipients see the report only: no drafts, no other versions, no
            workspace.
          </p>

          <div className="mt-10">
            <ShareManager
              publicId={publicId}
              initialShares={shares.map((share) => ({
                id: share.id,
                label: share.label,
                allowDownload: share.allowDownload,
                expiresAt: share.expiresAt,
                revokedAt: share.revokedAt,
                createdAt: share.createdAt,
                lastUsedAt: share.lastUsedAt,
                useCount: share.useCount,
              }))}
            />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
