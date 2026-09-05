import { getCurrentUser } from '@/lib/auth/server';
import { authoriseExport } from '@/lib/share/authorize';
import { hashIp, clientIpFrom } from '@/lib/security/rate-limit';
import { renderExport, isExportKind } from '@/lib/export/reports';
import { csvFilename, contentDispositionFor } from '@/lib/export/csv';
import { toPlatformError, PlatformError } from '@/lib/errors';
import type { StoredSource } from '@/schemas/research/shared';

/**
 * CSV download for one section of a report.
 *
 * Authorisation mirrors the report pages exactly: the owner may download
 * their own; a visitor may download only through a live share link minted
 * with download permission, presented as ?share=<token>. There is no
 * capability path any more — the public id alone opens nothing.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const url = new URL(request.url);
    const kind = url.searchParams.get('kind');

    if (!isExportKind(kind)) {
      throw new PlatformError('INVALID_INPUT', 'Unknown export type');
    }

    const user = await getCurrentUser();
    const job = await authoriseExport({
      publicId,
      userId: user?.id ?? null,
      shareToken: url.searchParams.get('share'),
      ipHash: hashIp(clientIpFrom(request.headers)),
    });

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
