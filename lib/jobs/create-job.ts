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

  return {
    job,
    cached: false,
    duplicate: false,
    tokensAvailable: reservation.available,
    tokensReserved: reservation.reserved,
  };
}
