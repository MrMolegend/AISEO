import 'server-only';
import { BRAND } from '@/config/brand';
import { REPORT_TOKEN_COST } from '@/config/report';
import { getEnv, researchProvidersReady, servesRealCustomers } from '@/lib/env';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';
import {
  marketEntryInputSchema,
  subjectOfMarketEntry,
} from '@/schemas/market-entry/input';
import { getTokenWallet } from '@/lib/tokens';
import { reservationKey, isValidSubmissionId } from '@/lib/tokens/idempotency';
import { checkResearchRateLimit } from '@/lib/security/rate-limit';
import { computeInputHash } from './cache-key';
import { getResearchJobStore, type ResearchJobRecord } from './store';

/**
 * Accepting a research job.
 *
 * The order of operations here is the whole design, and each step is where it
 * is for a reason:
 *
 *   1. Validate. Before anything costs anything. INVALID_INPUT never refunds
 *      because there is nothing yet to refund.
 *   2. Price from the server catalogue. The request names a package; it does
 *      not name a price. A price the client cannot influence is a price the
 *      client cannot forge.
 *   3. Rate limit. Cheap, and it protects everything after it.
 *   4. Cache. Before reserving, so a repeat costs nothing at all.
 *   5. Create the job row, then reserve against it. The reservation needs a job
 *      id to point at, and a job with no reservation is recoverable — it fails
 *      and refunds nothing, because nothing was taken. The reverse order would
 *      leave a charge with nothing to attribute it to.
 *   6. Return. The pipeline runs after the response.
 */

export interface CreateJobRequest {
  userId: string;
  /** Raw body; validated here, never trusted. */
  body: unknown;
  /** Client-generated, stable across retries of one click. */
  submissionId: string;
  /** For rate limiting. Already hashed by the caller. */
  ipHash: string | null;
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid-shaped optional field from the raw body, or null. */
function optionalUuid(body: unknown, key: string): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && UUID_SHAPE.test(value) ? value : null;
}

export interface CreateJobResult {
  job: ResearchJobRecord;
  /** True when an identical recent report was returned instead of running one. */
  cached: boolean;
  /** True when this submission id had already created a job. */
  duplicate: boolean;
  tokensAvailable: number;
  tokensReserved: number;
}

export async function createResearchJob(
  request: CreateJobRequest,
): Promise<CreateJobResult> {
  const env = getEnv();

  /* ── 1. Refuse to run on fabricated research ──────────────────────────── */

  /*
   * Checked first, and before anything is charged.
   *
   * A deployment real customers reach must never produce a report built on
   * fixture data: the output is confident, well-shaped and entirely fictional,
   * and nothing downstream — not the renderer, not the customer — can tell.
   * The health endpoint reports the same condition, and the runner checks it
   * again before synthesis, but doing it here is what makes it free: no row is
   * created, no credit is reserved, and there is nothing to refund.
   */
  if (servesRealCustomers(env) && !researchProvidersReady(env)) {
    throw new PlatformError(
      'RESEARCH_PROVIDER_UNAVAILABLE',
      'Live research providers are not configured on this deployment',
    );
  }

  /* ── 2. Validate, and price from the server ───────────────────────────── */

  if (!isValidSubmissionId(request.submissionId)) {
    throw new PlatformError('INVALID_INPUT', 'Missing or malformed submission id');
  }

  const parsed = marketEntryInputSchema.safeParse(request.body);
  if (!parsed.success) {
    throw new PlatformError('INVALID_INPUT', 'The brief did not validate', {
      context: {
        issues: parsed.error.issues.slice(0, 8).map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
  }

  const input = parsed.data;
  const subject = subjectOfMarketEntry(input);

  /*
   * The profile and draft references ride beside the brief, not inside it —
   * the input schema strips unknown keys, so neither can reach the stored
   * snapshot or the input hash. A profile id is only honoured when the store's
   * owner-filtered read confirms it is this user's; anyone else's id, or a
   * stale one, is indistinguishable from none at all having been sent —
   * except that naming one explicitly and not owning it is refused, because
   * silently ignoring it would attach the report to nothing without saying so.
   */
  const profileId = optionalUuid(request.body, 'profileId');
  const draftId = optionalUuid(request.body, 'draftId');

  if (profileId) {
    const { getBusinessProfileStore } = await import('@/lib/profiles/store');
    const profileStore = await getBusinessProfileStore();
    const profile = await profileStore.getForUser(profileId, request.userId);
    if (!profile) {
      throw new PlatformError('INVALID_INPUT', 'That business profile is not available', {
        context: {
          issues: [{ field: 'profileId', message: 'Choose one of your own profiles' }],
        },
      });
    }
  }

  /*
   * There is one product and one price, and the browser names neither.
   *
   * The previous version looked a cost up in a catalogue by an id the client
   * sent; this one does not read the request at all. A price the client cannot
   * influence is a price the client cannot forge.
   */
  const tokenCost = REPORT_TOKEN_COST;

  /* ── 3. Rate limit ─────────────────────────────────────────────────────── */

  const limit = await checkResearchRateLimit(request.userId, request.ipHash);
  if (!limit.allowed) {
    throw new PlatformError(limit.reason, limit.message, {
      context: { retryAfterSeconds: limit.retryAfterSeconds },
    });
  }

  /* ── 4. Cache ──────────────────────────────────────────────────────────── */

  const store = await getResearchJobStore();
  const wallet = await getTokenWallet();
  const inputHash = computeInputHash(input);

  const cacheTtlMs = env.RESEARCH_CACHE_TTL_HOURS * 60 * 60 * 1000;
  const cached = await store.findCached(request.userId, inputHash, cacheTtlMs);

  if (cached) {
    // Free, and clearly labelled as cached in the UI. Charging again for
    // research we already did and still hold would be indefensible; charging a
    // reduced amount is a pricing decision nobody has made yet.
    logger.info('jobs.cache_hit', {
      userId: request.userId,
      publicId: cached.publicId,
      packageId: input.packageId,
    });

    const balance = await wallet.getBalance(request.userId);
    return {
      job: cached,
      cached: true,
      duplicate: false,
      tokensAvailable: balance.available,
      tokensReserved: balance.reserved,
    };
  }

  /* ── 4b. Duplicate-active guard ────────────────────────────────────────── */

  /*
   * The same brief, already running. A double-click that minted two submission
   * ids, a second tab, an impatient refresh — all of them should join the job
   * that is already doing the work, not open a second reservation for
   * identical research. Returned as duplicate so the route knows there is
   * nothing to start.
   */
  const active = await store.findActive(request.userId, inputHash);
  if (active) {
    logger.info('jobs.duplicate_active', {
      userId: request.userId,
      publicId: active.publicId,
    });
    const balance = await wallet.getBalance(request.userId);
    return {
      job: active,
      cached: false,
      duplicate: true,
      tokensAvailable: balance.available,
      tokensReserved: balance.reserved,
    };
  }

  /* ── 5. Create, then reserve ───────────────────────────────────────────── */

  // Balance is checked before creating a row so that an insufficient balance
  // does not litter the dashboard with jobs that never ran.
  const balanceBefore = await wallet.getBalance(request.userId);
  if (balanceBefore.available < tokenCost) {
    // The message is internal; the customer sees the taxonomy's copy, which
    // speaks in report credits. Tokens never reach a customer-facing string.
    throw new PlatformError(
      'INSUFFICIENT_TOKENS',
      `A report costs ${tokenCost} internal tokens; the balance is ${balanceBefore.available}`,
      { context: { required: tokenCost, available: balanceBefore.available } },
    );
  }

  const job = await store.create({
    userId: request.userId,
    packageId: input.packageId,
    tokenCost,
    input,
    inputHash,
    subjectName: subject.name,
    /*
     * The target market, denormalised for listings.
     *
     * Reusing the `subject_domain` column rather than adding one: it is a
     * nullable text field that exists to save the dashboard from opening the
     * jsonb brief, and "which market is this dossier about" is exactly that
     * kind of question. Legacy rows keep the website hostname they were written
     * with; nothing reads the two as the same thing.
     */
    subjectDomain: input.targetCountry,
    profileId,
  });

  const reservation = await wallet.reserve({
    userId: request.userId,
    jobId: job.id,
    amount: tokenCost,
    idempotencyKey: reservationKey(request.submissionId),
    description: `${BRAND.defaultReportTitle} — ${subject.name}`,
    metadata: {
      packageId: input.packageId,
      publicId: job.publicId,
      targetCountry: input.targetCountry,
    },
  });

  if (reservation.replayed) {
    /*
     * The same submission id has already reserved. A double-click, or a retry
     * after a dropped response.
     *
     * The job row created a moment ago is orphaned — it has no reservation of
     * its own and must not run, because running it would do the work twice for
     * one payment. It is failed rather than deleted: no code path in this
     * application deletes a row, and a visible cancelled job is easier to
     * explain than a row that vanished.
     */
    await store.fail(job.id, 'DUPLICATE_SUBMISSION');

    logger.info('jobs.duplicate_submission', {
      userId: request.userId,
      submissionId: request.submissionId,
      orphanedJobId: job.publicId,
    });

    throw new PlatformError(
      'DUPLICATE_SUBMISSION',
      'This submission has already been accepted',
      { context: { submissionId: request.submissionId } },
    );
  }

  logger.info('jobs.created', {
    userId: request.userId,
    publicId: job.publicId,
    packageId: input.packageId,
    tokenCost,
    availableAfter: reservation.available,
  });

  if (draftId) {
    /*
     * The draft this brief grew from is frozen as provenance. Best-effort and
     * owner-filtered inside the store; a wrong or foreign draft id changes
     * nothing and costs nothing.
     */
    const { getResearchDraftStore } = await import('@/lib/drafts/store');
    const draftStore = await getResearchDraftStore();
    await draftStore.markSubmitted(draftId, request.userId, job.id).catch(() => {});
  }

  return {
    job,
    cached: false,
    duplicate: false,
    tokensAvailable: reservation.available,
    tokensReserved: reservation.reserved,
  };
}
