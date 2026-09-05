import { requireUser } from '@/lib/auth/server';
import { getResearchDraftStore } from '@/lib/drafts/store';
import { sanitiseDraftPayload } from '@/lib/validation/draft';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * Research drafts: the intake's autosave target.
 *
 * GET answers "is there something to pick back up?" with the most recent
 * active draft. POST opens a new one. Saves go to /api/drafts/[id] with the
 * revision the tab last read — see the store for why that matters.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  try {
    const user = await requireUser();
    const store = await getResearchDraftStore();
    const draft = await store.latestActive(user.id);
    return jsonResponse({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`draft-create:${user.id}`, 30, 3_600));

    const body = (await request.json().catch(() => null)) as {
      payload?: unknown;
      profileId?: unknown;
    } | null;

    const payload = sanitiseDraftPayload(body?.payload ?? {});
    if (!payload) {
      throw new PlatformError('INVALID_INPUT', 'The draft payload was not usable');
    }

    const profileId =
      typeof body?.profileId === 'string' && UUID_SHAPE.test(body.profileId)
        ? body.profileId
        : null;

    const store = await getResearchDraftStore();
    const draft = await store.create(user.id, payload, profileId);
    return jsonResponse({ draft }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
