import type { NextRequest } from 'next/server';
import { getAuditStore } from '@/lib/storage';
import { renderErrorCopy } from '@/lib/errors';
import { stageIndex, STAGES } from '@/lib/pipeline/stages';

/**
 * Lightweight polling endpoint for the processing screen.
 *
 * Deliberately does not return the report: a client polling every 1.5s does not
 * need 40KB of audit each time. When the status flips to complete the client
 * refreshes the route and the report arrives server-rendered.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;

  const store = await getAuditStore();
  const record = await store.getByPublicId(publicId);

  if (!record) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const body: Record<string, unknown> = {
    status: record.status,
    stage: record.stage,
    stageIndex: record.stageIndex,
    totalStages: STAGES.length,
    createdAt: record.createdAt,
  };

  if (record.status === 'failed' && record.errorCode) {
    const copy = renderErrorCopy(record.errorCode, record.domain);
    body.error = {
      code: record.errorCode,
      title: copy.title,
      body: copy.body,
      retryable: copy.retryable,
    };
  }

  if (record.status === 'complete') {
    body.stageIndex = stageIndex('saving');
  }

  return Response.json(body, {
    // A poll response must never be cached, by the browser or by a CDN.
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  });
}
