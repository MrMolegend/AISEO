import { getCurrentUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { STAGES, stageLabel, stageIndex, isTerminal } from '@/lib/jobs/stages';
import { renderErrorCopy } from '@/lib/errors';

/**
 * Polling endpoint.
 *
 * Deliberately lightweight: status, stage and nothing else. The report can be
 * hundreds of kilobytes, and returning it on every poll would mean sending it
 * dozens of times to deliver it once. The browser follows up with a page load
 * when the status turns terminal.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    return Response.json(
      { error: 'AUTH_REQUIRED' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, user.id);

  // Owner-scoped: someone else's job is indistinguishable from one that does
  // not exist, which is the correct amount of information to give.
  if (!job) {
    return Response.json(
      { error: 'NOT_FOUND' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    {
      status: job.status,
      stage: job.stage,
      stageLabel: stageLabel(job.stage),
      /*
       * Position, not a percentage.
       *
       * There is deliberately no `progress` field any more. Stages do not take
       * equal time — a twelve-query search phase and a single synthesis call
       * are minutes apart — so any percentage derived from position is a number
       * the product invented, and it produces the bar that sits at 94% while
       * nothing happens. The screen shows which stage is running and how many
       * remain, which is true.
       */
      stageIndex: stageIndex(job.stage),
      stageCount: STAGES.length,
      done: isTerminal(job.status),
      subject: job.subjectName,
      sourcesFound: job.sources.length,
      ...(job.errorCode
        ? {
            errorCode: job.errorCode,
            error: renderErrorCopy(job.errorCode, job.subjectDomain ?? job.subjectName),
          }
        : {}),
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
