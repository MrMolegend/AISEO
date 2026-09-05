import type { Metadata } from 'next';
import { SiteFooter } from '@/components/layout/site-footer';
import { DossierView } from '@/components/dossier/dossier-view';
import { ReportView } from '@/components/research/report/report-view';
import { Logo } from '@/components/ui/logo';
import { Meta } from '@/components/ui/panel';
import { BRAND, pageTitle } from '@/config/brand';
import { isResearchPackageId } from '@/config/packages';
import { isLegacyReport } from '@/lib/jobs/labels';
import { isPlatformError, renderErrorCopy } from '@/lib/errors';
import { resolveSharedAccess, type SharedAccess } from '@/lib/share/authorize';
import { hashIp, clientIpFrom } from '@/lib/security/rate-limit';
import { headers } from 'next/headers';
import { marketEntryReportSchema } from '@/schemas/market-entry/report';
import type { StoredSource } from '@/schemas/research/shared';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: pageTitle('Shared report'),
  // Belt: robots meta here; braces: the X-Robots-Tag header in next.config.
  robots: { index: false, follow: false, noarchive: true },
};

/**
 * A report, as its recipient sees it.
 *
 * The token in the URL is the entire authorisation: resolved against stored
 * hashes, checked for expiry and revocation, rate limited by presenting
 * address, audited without ever logging the token. What renders is the
 * selected report and nothing around it — no owner navigation, no workspace,
 * no other versions, no account surface. The recipient is a reader, not a
 * tenant.
 *
 * Every way the link can be dead renders the same calm page: expired,
 * revoked and never-existed are indistinguishable by design.
 */
export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let access: SharedAccess;
  try {
    const requestHeaders = await headers();
    access = await resolveSharedAccess(token, hashIp(clientIpFrom(requestHeaders)));
  } catch (error) {
    const code = isPlatformError(error) ? error.code : 'SHARE_LINK_INVALID';
    const copy = renderErrorCopy(code === 'RATE_LIMITED' ? code : 'SHARE_LINK_INVALID');
    return (
      <>
        <SharedHeader />
        <main
          id="main"
          className="mx-auto max-w-[var(--container-narrow)] px-5 py-20 md:px-8"
        >
          <h1 className="font-display text-text text-[30px] leading-tight md:text-[36px]">
            {copy.title}
          </h1>
          <p className="text-text-muted measure mt-4 text-[15px] leading-relaxed">
            {copy.body}
          </p>
        </main>
        <SiteFooter />
      </>
    );
  }

  const { job, share } = access;

  const banner = (
    <div className="border-rule mx-auto max-w-[var(--container-page)] border-b px-5 py-3 md:px-8 print:hidden">
      <p className="text-text-subtle text-[13px] leading-relaxed">
        <strong className="text-text font-medium">Shared with you.</strong> The owner of
        this report shared it deliberately; the link can expire or be withdrawn by them at
        any time.
        {share.expiresAt &&
          ` This one is valid until ${new Date(share.expiresAt).toLocaleDateString(
            'en-GB',
            { day: 'numeric', month: 'long', year: 'numeric' },
          )}.`}
      </p>
    </div>
  );

  if (!isLegacyReport(job.packageId)) {
    const parsed = marketEntryReportSchema.safeParse(job.report);
    if (!parsed.success) {
      // A shared link to a report this page cannot render is a dead link.
      const copy = renderErrorCopy('SHARE_LINK_INVALID');
      return (
        <>
          <SharedHeader />
          <main
            id="main"
            className="mx-auto max-w-[var(--container-narrow)] px-5 py-20 md:px-8"
          >
            <h1 className="font-display text-text text-[30px] leading-tight">
              {copy.title}
            </h1>
            <p className="text-text-muted mt-4 text-[15px]">{copy.body}</p>
          </main>
          <SiteFooter />
        </>
      );
    }

    return (
      <>
        <SharedHeader />
        <main id="main">
          {banner}
          <DossierView
            report={parsed.data}
            publicId={job.publicId}
            isOwner={false}
            shareToken={token}
            shareAllowsDownload={share.allowDownload}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <SharedHeader />
      <main id="main">
        {banner}
        <ReportView
          packageId={
            isResearchPackageId(job.packageId) ? job.packageId : 'competitor-intelligence'
          }
          report={job.report as Record<string, unknown>}
          sources={job.sources as StoredSource[]}
          meta={job.meta}
          publicId={job.publicId}
          subject={job.subjectName}
          completedAt={job.completedAt ?? job.createdAt}
          cached={false}
          isOwner={false}
        />
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * A minimal header for recipients: the brand and nothing personal. The full
 * site header resolves the viewer's account and balance, none of which
 * belongs on a page whose reader is a guest.
 */
function SharedHeader() {
  return (
    <header className="border-rule border-b">
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--container-page)] items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label={`${BRAND.name} home`}>
          <Logo />
        </Link>
        <Meta>Shared report</Meta>
      </div>
    </header>
  );
}
