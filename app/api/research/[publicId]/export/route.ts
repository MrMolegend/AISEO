import { getCurrentUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { renderExport, isExportKind } from '@/lib/export/reports';
import { csvFilename, contentDispositionFor } from '@/lib/export/csv';
import { toPlatformError, PlatformError } from '@/lib/errors';
import type { StoredSource } from '@/schemas/research/shared';

/**
 * CSV download for one section of a report.
 *
 * Authorisation mirrors the report page exactly: the owner may download their
 * own, and anyone holding the capability link may download the shared one. The
 * owner lookup is tried first so an owner viewing an incomplete job gets the
 * right answer rather than a 404 from the public path.
 *
 * A share link that renders a lead list but refuses to export it would be a
 * distinction without a difference — the data is already on the page.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const kind = new URL(request.url).searchParams.get('kind');

    if (!isExportKind(kind)) {
      throw new PlatformError('INVALID_INPUT', 'Unknown export type');
    }

    const store = await getResearchJobStore();
    const user = await getCurrentUser();

    const job =
      (user ? await store.getForUser(publicId, user.id) : null) ??
      (await store.getPublic(publicId));

    if (!job) throw new PlatformError('NOT_FOUND', 'No such report');
    if (job.status !== 'complete' || !job.report) {
      throw new PlatformError('NOT_FOUND', 'That report is not finished');
    }

    const csv = renderExport(kind, job.report, job.sources as StoredSource[]);
    if (!csv) {
      throw new PlatformError('EXPORT_FAILED', `This report has no ${kind} to export`);
    }

    return new Response(csv, {
      status: 200,
      headers: {
        // charset matters: without it some clients guess, and the BOM plus a
        // wrong guess is worse than either alone.
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': contentDispositionFor(
          csvFilename(job.subjectName, kind, job.completedAt ?? job.createdAt),
        ),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const platform = toPlatformError(error);
    return Response.json(
      { error: platform.code, message: platform.copy.body },
      { status: platform.status },
    );
  }
}
