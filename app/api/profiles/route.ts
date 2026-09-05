import { requireUser } from '@/lib/auth/server';
import { getBusinessProfileStore } from '@/lib/profiles/store';
import { businessProfileSchema } from '@/schemas/business-profile';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * Business profiles: list and create.
 *
 * Every read and write is scoped to the authenticated user inside the store's
 * own queries; this route contributes authentication and validation, nothing
 * else. Validation errors come back as per-field issues in the same shape the
 * intake uses, so the profile form routes them onto fields the same way.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const includeArchived =
      new URL(request.url).searchParams.get('archived') === 'include';

    const store = await getBusinessProfileStore();
    const profiles = await store.listForUser(user.id, { includeArchived });
    return jsonResponse({ profiles });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`profiles:${user.id}`, 30, 3_600));

    const body = await request.json().catch(() => null);
    const parsed = businessProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new PlatformError('INVALID_INPUT', 'Profile validation failed', {
        context: {
          issues: parsed.error.issues.map((issue) => ({
            field: String(issue.path[0] ?? ''),
            message: issue.message,
          })),
        },
      });
    }

    const store = await getBusinessProfileStore();
    const profile = await store.create(user.id, parsed.data);
    return jsonResponse({ profile }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
