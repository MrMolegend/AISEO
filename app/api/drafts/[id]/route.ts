import { requireUser } from '@/lib/auth/server';
import { getResearchDraftStore } from '@/lib/drafts/store';
import { sanitiseDraftPayload } from '@/lib/validation/draft';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';

/**
 * One draft: autosave writes, reads, and discarding.
 *
 * Every save carries the revision the tab last read; a stale one is refused
 * with DRAFT_CONFLICT rather than silently merged. The autosave limit is per
 * user and generous — the client debounces, so hitting it means a client that
 * is misbehaving, not a customer typing quickly.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function draftId(params: Promise<{ id: string }>): Promise<string> {
  const { id } = await params;
  if (!UUID_SHAPE.test(id)) throw new PlatformError('NOT_FOUND', 'No such draft');
  return id;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const store = await getResearchDraftStore();
    const draft = await store.getForUser(await draftId(params), user.id);
    if (!draft) throw new PlatformError('NOT_FOUND', 'No such draft');
    return jsonResponse({ draft });
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

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`draft-save:${user.id}`, 240, 3_600));

    const body = (await request.json().catch(() => null)) as {
      payload?: unknown;
      revision?: unknown;
      profileId?: unknown;
    } | null;

    const payload = sanitiseDraftPayload(body?.payload ?? null);
    if (!payload) {
      throw new PlatformError('INVALID_INPUT', 'The draft payload was not usable');
    }
    if (typeof body?.revision !== 'number' || !Number.isInteger(body.revision)) {
      throw new PlatformError('INVALID_INPUT', 'The save must state its revision');
    }

    const profileId =
      body?.profileId === null
        ? null
        : typeof body?.profileId === 'string' && UUID_SHAPE.test(body.profileId)
          ? body.profileId
          : undefined;

    const store = await getResearchDraftStore();
    const draft = await store.save(
      await draftId(params),
      user.id,
      payload,
      body.revision,
      profileId,
    );
    return jsonResponse({ draft });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const store = await getResearchDraftStore();
    const discarded = await store.discard(await draftId(params), user.id);
    if (!discarded) throw new PlatformError('NOT_FOUND', 'No such draft');
    return jsonResponse({ discarded: true });
  } catch (error) {
    return errorResponse(error);
  }
}
