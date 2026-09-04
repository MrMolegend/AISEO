import { requireMember, recordAudit } from '@/lib/auth/membership';
import { getIcpStore } from '@/lib/icps/store';
import { icpInputSchema } from '@/schemas/icp';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * Ideal customer profiles: list and create.
 *
 * Workspace-shared: any member reads them; the campaign-managing roles
 * write them. Validation errors come back per field in the intake's shape.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireMember();
    const includeArchived =
      new URL(request.url).searchParams.get('archived') === 'include';
    const store = await getIcpStore();
    const icps = await store.list({ includeArchived });
    return jsonResponse({ icps });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireMember(...ROLES_WHO_MANAGE_CAMPAIGNS);

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`icps:${user.id}`, 30, 3_600));

    const body = await request.json().catch(() => null);
    const parsed = icpInputSchema.safeParse(body);
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

    const store = await getIcpStore();
    const icp = await store.create(parsed.data, user.id);
    await recordAudit(user.id, 'icp.created', 'icp', icp.id, { name: icp.name });
    return jsonResponse({ icp }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
