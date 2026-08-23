import { after, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAudit } from '@/lib/pipeline/create-audit';
import { runAuditPipeline } from '@/lib/pipeline/run-audit';
import { isAuditError, renderErrorCopy, toAuditError } from '@/lib/errors';
import { MAX_URL_LENGTH } from '@/lib/security/url-validator';
import { logger } from '@/lib/observability/logger';

/**
 * Audit creation.
 *
 * Node runtime, not Edge: the SSRF guard needs DNS resolution, which Edge does
 * not provide.
 *
 * The response is returned as soon as there is a row to poll, and the pipeline
 * runs afterwards via `after()`. A synchronous 90-second request would be
 * fragile against browser, proxy and mobile-network timeouts, and a page refresh
 * would abandon the work. This way the report URL is valid from the moment it is
 * issued and a refresh simply resumes.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const bodySchema = z.object({
  url: z.string().min(1).max(MAX_URL_LENGTH),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_URL', null);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse('INVALID_URL', null);
  }

  try {
    const { publicId, cached } = await createAudit(parsed.data.url, request.headers);

    if (!cached) {
      // Runs after the response is flushed. The pipeline owns its own errors and
      // records them against the audit row, so nothing here can reject.
      after(async () => {
        await runAuditPipeline(publicId);
      });
    }

    return Response.json({ publicId, cached }, { status: cached ? 200 : 202 });
  } catch (error) {
    const auditError = toAuditError(error);
    if (!isAuditError(error)) {
      logger.error('api.audits.unexpected', { error: auditError });
    }

    const retryAfter = auditError.context.retryAfterSeconds;
    return errorResponse(
      auditError.code,
      null,
      typeof retryAfter === 'number' ? retryAfter : undefined,
    );
  }
}

function errorResponse(
  code: Parameters<typeof renderErrorCopy>[0],
  domain: string | null,
  retryAfterSeconds?: number,
) {
  const copy = renderErrorCopy(code, domain);
  const headers = new Headers();
  if (retryAfterSeconds !== undefined) {
    headers.set('Retry-After', String(retryAfterSeconds));
  }

  return Response.json(
    {
      error: {
        code,
        title: copy.title,
        body: copy.body,
        retryable: copy.retryable,
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
      },
    },
    { status: copy.status, headers },
  );
}
