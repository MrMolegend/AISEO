import 'server-only';
import { nanoid } from 'nanoid';
import { validateAndNormalizeUrl } from '@/lib/security/url-validator';
import { localTestingEnabled } from '@/lib/security/local-testing';
import { assertAddressIsPublic, checkAddress } from '@/lib/security/ssrf-guard';
import { getAuditStore } from '@/lib/storage';
import { clientIpFrom, getRateLimiter, hashIp, hashUrl } from '@/lib/security/rate-limit';
import { PlatformError } from '@/lib/errors';
import { getEnv } from '@/lib/env';
import { createLogger, LOG_EVENTS } from '@/lib/observability/logger';

/**
 * Audit intake: everything between "a stranger posted a URL" and "there is a row
 * to work on".
 *
 * Ordered by cost. Syntactic validation is free, so it goes first; the global cap
 * and per-IP limits are one Redis round-trip; the cache lookup is one database
 * read that can save an entire AI call; the lock is what stops a double-click
 * paying twice. Only after all of that does anything expensive begin.
 */

export interface CreateAuditOutcome {
  publicId: string;
  /** True when an existing recent audit was returned instead of starting one. */
  cached: boolean;
}

/**
 * 12 characters of nanoid ≈ 71 bits of entropy.
 *
 * Report URLs are public-by-link, so the id *is* the capability. Sequential
 * database ids are never exposed; guessing one of these is not feasible.
 */
const PUBLIC_ID_LENGTH = 12;

export async function createAudit(
  rawUrl: string,
  headers: Headers,
): Promise<CreateAuditOutcome> {
  const env = getEnv();
  const log = createLogger();

  // Must apply the same relaxations as the fetch layer, or intake would accept
  // a URL the fetcher then refuses (or, worse, the reverse).
  const validation = validateAndNormalizeUrl(rawUrl, {
    allowNonStandardPorts: localTestingEnabled(),
  });
  if (!validation.ok) {
    log.info(LOG_EVENTS.urlRejected, { reason: validation.reason });
    throw new PlatformError('INVALID_URL', `Rejected: ${validation.reason}`, {
      context: { reason: validation.reason },
    });
  }

  /*
   * When the host is an IP literal we can judge it here, synchronously, without
   * DNS. Doing so matters: otherwise a request for 169.254.169.254 is accepted
   * with a 202, consumes a rate-limit slot, creates a row, and only fails once
   * the pipeline reaches the SSRF guard — so the caller sees a progress screen
   * for an address we already knew we would refuse.
   *
   * A hostname cannot be judged without resolving it, which is the guard's job
   * at fetch time.
   */
  const literal = checkAddress(validation.hostname);
  if (literal.reason !== 'unparseable') {
    // assertAddressIsPublic rather than the raw predicate: it is the one place
    // the local-testing relaxation is applied, so intake and the fetch layer
    // cannot disagree about what is reachable.
    try {
      assertAddressIsPublic(validation.hostname, 'intake');
    } catch {
      log.info(LOG_EVENTS.urlRejected, { reason: literal.reason });
      throw new PlatformError('BLOCKED_URL', 'Address is not publicly routable', {
        context: { reason: literal.reason },
      });
    }
  }

  const { normalized, domain } = validation;
  const urlHash = hashUrl(normalized);
  const ip = clientIpFrom(headers);
  const ipHash = ip === 'unknown' ? null : hashIp(ip);

  log.info(LOG_EVENTS.urlAccepted, { domain });

  const limiter = await getRateLimiter();
  const store = await getAuditStore();

  // ── Cache first: a hit costs nothing and skips every limit below ────────
  const cacheTtlMs = env.RESEARCH_CACHE_TTL_HOURS * 3_600_000;
  const fresh = await store.findFreshByUrlHash(urlHash, cacheTtlMs);
  if (fresh) {
    log.info(LOG_EVENTS.cacheHit, { domain, publicId: fresh.publicId });
    return { publicId: fresh.publicId, cached: true };
  }

  // ── Global circuit breaker ──────────────────────────────────────────────
  if (!(await limiter.checkGlobalCap())) {
    log.warn(LOG_EVENTS.rateLimited, { scope: 'global' });
    throw new PlatformError('CAPACITY', 'Daily global audit cap reached');
  }

  // ── Per-client limits ───────────────────────────────────────────────────
  if (ipHash) {
    const verdict = await limiter.check(ipHash);
    if (!verdict.allowed) {
      log.warn(LOG_EVENTS.rateLimited, {
        scope: 'ip',
        retryAfterSeconds: verdict.retryAfterSeconds,
      });
      throw new PlatformError('RATE_LIMITED', 'Per-client rate limit reached', {
        context: { retryAfterSeconds: verdict.retryAfterSeconds },
      });
    }
  }

  // ── In-flight lock ──────────────────────────────────────────────────────
  // A double-click, or two people submitting the same site at once, must cost
  // one AI call rather than two. If the lock is held, the audit that holds it
  // will be found by the cache lookup on the next attempt.
  const acquired = await limiter.acquireLock(urlHash, 300);
  if (!acquired) {
    log.info('audit.already_in_flight', { domain });
    throw new PlatformError('RATE_LIMITED', 'An audit of this site is already running', {
      context: { retryAfterSeconds: 30 },
    });
  }

  const publicId = nanoid(PUBLIC_ID_LENGTH);

  try {
    await store.create({
      publicId,
      requestedUrl: rawUrl.slice(0, 500),
      normalizedUrl: normalized,
      urlHash,
      domain,
      ipHash,
    });
  } catch (error) {
    // A row that was never created must not leave the URL locked.
    await limiter.releaseLock(urlHash).catch(() => {});
    throw error;
  }

  return { publicId, cached: false };
}
