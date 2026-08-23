import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ReportShell } from '@/components/audit/report/report-shell';
import { ProcessingScreen } from '@/components/audit/processing/processing-screen';
import { AuditErrorState } from '@/components/audit/states/audit-error-state';
import { getAuditStore } from '@/lib/storage';

/**
 * One route, three states.
 *
 * The audit's status decides what renders: processing, report, or a designed
 * error. Because the URL is issued before the work starts, this address is valid
 * from the first moment and a refresh mid-audit simply resumes — which is the
 * whole reason the pipeline is job-based rather than a blocking request.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ publicId: string }>;
}): Promise<Metadata> {
  const { publicId } = await params;
  const store = await getAuditStore();
  const record = await store.getByPublicId(publicId);

  const title = record ? `SEO audit for ${record.domain}` : 'Audit';

  return {
    title,
    /*
     * Real audits are never indexed. Publishing an automated critique of someone
     * else's website under our domain is a privacy problem, and thousands of
     * near-identical generated pages is precisely the thin-content pattern this
     * product would flag in an audit of our own site. Only /sample is indexed.
     */
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: `/audit/${publicId}` },
  };
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const store = await getAuditStore();
  const record = await store.getByPublicId(publicId);

  if (!record) notFound();

  return (
    <>
      <SiteHeader />
      <main>
        {record.status === 'complete' && record.report ? (
          <ReportShell report={record.report} />
        ) : record.status === 'failed' ? (
          <AuditErrorState code={record.errorCode ?? 'UNKNOWN'} domain={record.domain} />
        ) : record.status === 'complete' ? (
          // Complete but the stored report failed to re-validate on read — a
          // schema change or a corrupted row. Better a clean error than a page
          // that crashes halfway down.
          <AuditErrorState code="STORAGE_ERROR" domain={record.domain} />
        ) : (
          <ProcessingScreen
            publicId={record.publicId}
            domain={record.domain}
            initialStageIndex={record.stageIndex}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
