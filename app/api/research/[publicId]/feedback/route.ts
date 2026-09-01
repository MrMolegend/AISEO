import { z } from 'zod';
import { requireUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getReportFeedbackStore, FEEDBACK_CATEGORIES } from '@/lib/feedback/store';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * Feedback on one report: read yours, revise yours.
 *
 * An upsert against (user, job), so a customer has exactly one revisable
 * verdict and no way to accumulate duplicates. The comment is bounded and
 * treated as untrusted text everywhere it renders — including the admin
 * console.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const feedbackSchema = z.object({
  useful: z.boolean({ error: 'Say whether the report was useful' }),
  category: z.enum(FEEDBACK_CATEGORIES).nullable().default(null),
  comment: z
    .string()
    .trim()
    .max(2000, { error: 'Keep this under 2000 characters' })
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .default(null),
});

async function ownedJobId(publicId: string, userId: string): Promise<string> {
  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, userId);
  if (!job || job.status !== 'complete') {
    throw new PlatformError('NOT_FOUND', 'No such report');
  }
  return job.id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;
    const jobId = await ownedJobId(publicId, user.id);

    const feedback = await (await getReportFeedbackStore()).getForUser(user.id, jobId);
    return jsonResponse({ feedback });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`feedback:${user.id}`, 30, 3_600));

    const body = await request.json().catch(() => null);
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'The feedback did not validate', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const jobId = await ownedJobId(publicId, user.id);
    const feedback = await (
      await getReportFeedbackStore()
    ).upsert(user.id, jobId, parsed.data);
    return jsonResponse({ feedback });
  } catch (error) {
    return errorResponse(error);
  }
}
