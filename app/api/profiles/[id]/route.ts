import { requireUser } from '@/lib/auth/server';
import { getBusinessProfileStore } from '@/lib/profiles/store';
import { businessProfileSchema } from '@/schemas/business-profile';
import { PlatformError } from '@/lib/errors';
import { jsonResponse, errorResponse } from '@/lib/api/respond';

/**
 * One business profile: read, replace, archive and restore.
 *
 * The store's queries carry the ownership filter, so a profile id belonging
 * to someone else behaves exactly like an id that does not exist — the same
 * NOT_FOUND, with nothing to learn from the difference.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A malformed id is a NOT_FOUND, not a 500 from the database driver. */
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function profileId(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) {
    throw new PlatformError('NOT_FOUND', 'No such profile');
  }
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const store = await getBusinessProfileStore();
    const profile = await store.getForUser(await profileId(params), user.id);
    if (!profile) throw new PlatformError('NOT_FOUND', 'No such profile');
    return jsonResponse({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();

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
    const profile = await store.update(await profileId(params), user.id, parsed.data);
    if (!profile) throw new PlatformError('NOT_FOUND', 'No such profile');
    return jsonResponse({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Archive state only: { archived: boolean }. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();

    const body = (await request.json().catch(() => null)) as {
      archived?: unknown;
    } | null;
    if (typeof body?.archived !== 'boolean') {
      throw new PlatformError('INVALID_INPUT', 'archived must be true or false');
    }

    const store = await getBusinessProfileStore();
    const changed = await store.setArchived(
      await profileId(params),
      user.id,
      body.archived,
    );
    if (!changed) throw new PlatformError('NOT_FOUND', 'No such profile');
    return jsonResponse({ archived: body.archived });
  } catch (error) {
    return errorResponse(error);
  }
}
