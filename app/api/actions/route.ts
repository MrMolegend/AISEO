import { requireUser } from '@/lib/auth/server';
import { getActionItemStore } from '@/lib/actions/store';
import { createActionSchema } from '@/schemas/action-item';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * The action workspace: list and manual creation.
 *
 * Imports from a report go through /api/research/[publicId]/actions, which
 * proves report ownership on the way; this route handles the rows a customer
 * writes by hand.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const jobId = new URL(request.url).searchParams.get('jobId') ?? undefined;

    const store = await getActionItemStore();
    const actions = await store.listForUser(user.id, { jobId });
    return jsonResponse({ actions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`action-create:${user.id}`, 120, 3_600));

    const body = await request.json().catch(() => null);
    const parsed = createActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'The action did not validate', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const store = await getActionItemStore();
    const action = await store.create(user.id, parsed.data);
    return jsonResponse({ action }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
