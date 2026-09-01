import { after } from 'next/server';
import { requireUser } from '@/lib/auth/server';
import { createResearchJob } from '@/lib/jobs/create-job';
import { runResearchJob } from '@/lib/jobs/run-job';
import { toPlatformError } from '@/lib/errors';
import { hashIp, clientIpFrom } from '@/lib/security/rate-limit';
import { logger } from '@/lib/observability/logger';

/**
 * Starts a research job.
 *
 * Returns as soon as the job exists and the tokens are reserved, then runs the
 * pipeline in `after()`. A synchronous request that took four minutes would be
 * at the mercy of every proxy, browser timeout and mobile network between here
 * and the user; splitting it means a refresh resumes correctly and the report
 * URL is valid from the moment it is issued.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);
    const submissionId =
      body && typeof body === 'object' && 'submissionId' in body
        ? String((body as { submissionId: unknown }).submissionId)
        : '';

    const result = await createResearchJob({
      userId: user.id,
      body,
      submissionId,
      ipHash: hashIp(clientIpFrom(request.headers)),
    });

    // A cache hit has nothing to run; a duplicate's original is already
    // running and must not be started a second time.
    if (!result.cached && !result.duplicate) {
      after(async () => {
        try {
          await runResearchJob(result.job);
        } catch (error) {
          // runResearchJob settles its own failures; reaching here means the
          // settling itself threw, which is the one case needing a human.
          logger.error('research.after_hook_failed', {
            publicId: result.job.publicId,
            error: String(error),
          });
        }
      });
    }

    return Response.json(
      {
        publicId: result.job.publicId,
        cached: result.cached,
        tokensAvailable: result.tokensAvailable,
        tokensReserved: result.tokensReserved,
      },
      { status: 202, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const platform = toPlatformError(error);

    // The code and the written copy go to the client; the internal message
    // never does — it can carry hostnames and upstream provider detail.
    return Response.json(
      {
        error: platform.code,
        title: platform.copy.title,
        message: platform.copy.body,
        retryable: platform.copy.retryable,
        ...(platform.context.issues ? { issues: platform.context.issues } : {}),
        ...(platform.context.retryAfterSeconds
          ? { retryAfterSeconds: platform.context.retryAfterSeconds }
          : {}),
      },
      { status: platform.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
