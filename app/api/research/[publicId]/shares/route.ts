import { requireUser } from '@/lib/auth/server';
import { getResearchJobStore } from '@/lib/jobs/store';
import { getShareLinkStore } from '@/lib/share/store';
import { PlatformError } from '@/lib/errors';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { jsonResponse, errorResponse, assertWithinLimit } from '@/lib/api/respond';
import { getEnv } from '@/lib/env';

/**
 * Share links for one report: list and mint.
 *
 * The raw token appears exactly once, in the POST response that minted it —
 * the list endpoint returns metadata only, because the server no longer has
 * the token to show. Owner-scoped throughout via the job read.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownedJob(publicId: string, userId: string) {
  const store = await getResearchJobStore();
  const job = await store.getForUser(publicId, userId);
  if (!job || job.status !== 'complete') {
    throw new PlatformError('NOT_FOUND', 'No such report');
  }
  return job;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;
    const job = await ownedJob(publicId, user.id);

    const shares = await (await getShareLinkStore()).listForJob(user.id, job.id);
    return jsonResponse({ shares });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const user = await requireUser();
    const { publicId } = await params;

    const limiter = await getRateLimiter();
    assertWithinLimit(await limiter.checkWindow(`share-create:${user.id}`, 30, 3_600));

    const body = (await request.json().catch(() => null)) as {
      label?: unknown;
      expiresInDays?: unknown;
      allowDownload?: unknown;
    } | null;

    const label =
      typeof body?.label === 'string' && body.label.trim().length > 0
        ? body.label.trim().slice(0, 120)
        : null;
    const expiresInDays =
      typeof body?.expiresInDays === 'number' &&
      Number.isInteger(body.expiresInDays) &&
      body.expiresInDays >= 1 &&
      body.expiresInDays <= 365
        ? body.expiresInDays
        : null;
    const allowDownload = body?.allowDownload === true;

    const job = await ownedJob(publicId, user.id);
    const { share, rawToken } = await (
      await getShareLinkStore()
    ).create(user.id, { jobId: job.id, label, expiresInDays, allowDownload });

    // The one moment the raw token exists in a response. The URL is built
    // server-side so the client cannot get the origin wrong.
    const url = new URL(`/shared/${rawToken}`, getEnv().NEXT_PUBLIC_SITE_URL).toString();

    return jsonResponse({ share, url }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
