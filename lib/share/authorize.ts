import 'server-only';
import { getShareLinkStore, type ShareLinkRecord } from '@/lib/share/store';
import { looksLikeShareToken } from '@/lib/share/tokens';
import { getResearchJobStore, type ResearchJobRecord } from '@/lib/jobs/store';
import { getRateLimiter } from '@/lib/security/rate-limit';
import { PlatformError } from '@/lib/errors';

/**
 * Share-token authorisation, in one place.
 *
 * A validated live token IS the authorisation: it names exactly one report
 * (the share row carries the job's internal id) and exactly one privilege
 * beyond viewing (download, when the owner allowed it). Every failure mode —
 * junk token, unknown token, expired, revoked — is the same
 * SHARE_LINK_INVALID to the visitor, because differentiating them would
 * teach a guesser which failures were near-misses. The audit trail records
 * the difference; the response never does.
 *
 * Resolution is rate limited by presenting IP before any storage read: a
 * token space of 2^256 does not need the limiter, but the database does.
 */

export interface SharedAccess {
  job: ResearchJobRecord;
  share: ShareLinkRecord;
}

export async function resolveSharedAccess(
  rawToken: string,
  ipHash: string | null,
): Promise<SharedAccess> {
  const limiter = await getRateLimiter();
  const verdict = await limiter.checkWindow(`share-view:${ipHash ?? 'unknown'}`, 60, 600);
  if (!verdict.allowed) {
    throw new PlatformError('RATE_LIMITED', 'Too many share-link attempts', {
      context: { retryAfterSeconds: verdict.retryAfterSeconds },
    });
  }

  if (!looksLikeShareToken(rawToken)) {
    throw new PlatformError('SHARE_LINK_INVALID', 'Malformed share token');
  }

  const shares = await getShareLinkStore();
  const resolved = await shares.resolve(rawToken, ipHash);
  if (!resolved || !resolved.valid) {
    throw new PlatformError('SHARE_LINK_INVALID', 'Unknown, expired or revoked token');
  }

  const store = await getResearchJobStore();
  const job = await store.getForShare(resolved.share.jobId);
  if (!job) {
    throw new PlatformError('SHARE_LINK_INVALID', 'The shared report no longer exists');
  }

  return { job, share: resolved.share };
}

/**
 * May this request download an export of this report?
 *
 * The owner always may. A share token may only when it is live, names THIS
 * report, and was minted with download permission.
 */
export async function authoriseExport(input: {
  publicId: string;
  userId: string | null;
  shareToken: string | null;
  ipHash: string | null;
}): Promise<ResearchJobRecord> {
  const store = await getResearchJobStore();

  if (input.userId) {
    const owned = await store.getForUser(input.publicId, input.userId);
    if (owned) return owned;
  }

  if (input.shareToken) {
    const { job, share } = await resolveSharedAccess(input.shareToken, input.ipHash);
    if (job.publicId === input.publicId && share.allowDownload) return job;
    throw new PlatformError('SHARE_LINK_INVALID', 'This link does not permit downloads');
  }

  throw new PlatformError('NOT_FOUND', 'No such report');
}
