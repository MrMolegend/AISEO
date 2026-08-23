import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { getEnv } from '@/lib/env';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';
import { getTokenWallet } from './index';
import { adminGrantKey } from './idempotency';
import type { MutationResult } from './types';

/**
 * Operator token grants.
 *
 * This is the one operation in the system that creates spendable value from
 * nothing, so its reachability matters more than its implementation.
 *
 * Three things guard it:
 *
 *   1. ADMIN_GRANT_SECRET absent means the route is disabled outright. Not
 *      "open to anyone", not "logs a warning" — the request is refused. A
 *      deployment that forgot to set the secret has no grant endpoint at all,
 *      which is the correct failure direction.
 *   2. The comparison is constant-time. A `===` on a secret leaks its length
 *      and then its content to anyone patient enough to measure.
 *   3. Every grant carries an idempotency key derived from an operator-supplied
 *      reference, so re-running the same command does not stack credits.
 *
 * The secret is never logged, and neither is any prefix of it.
 */

const MIN_SECRET_LENGTH = 24;

/** Constant-time compare that does not leak length through an early return. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) {
    // Still burn a comparison so the timing of a length mismatch resembles a
    // content mismatch.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function adminGrantsEnabled(): boolean {
  const secret = getEnv().ADMIN_GRANT_SECRET;
  return Boolean(secret && secret.length >= MIN_SECRET_LENGTH);
}

/**
 * Authorises an operator grant request.
 *
 * Throws rather than returning false: there is no caller that should proceed
 * with an unauthorised grant, so making it impossible to ignore is worth more
 * than a boolean.
 */
export function assertAdminGrantAuthorised(
  providedSecret: string | null | undefined,
): void {
  const expected = getEnv().ADMIN_GRANT_SECRET;

  if (!expected || expected.length < MIN_SECRET_LENGTH) {
    logger.warn('tokens.admin_grant_disabled', {
      reason: 'ADMIN_GRANT_SECRET is not set',
    });
    throw new PlatformError('NOT_FOUND', 'Admin grants are not enabled');
  }

  if (!providedSecret || !secretsMatch(providedSecret, expected)) {
    logger.warn('tokens.admin_grant_rejected', {});
    // NOT_FOUND rather than FORBIDDEN: an endpoint that admits it exists is an
    // endpoint worth attacking.
    throw new PlatformError('NOT_FOUND', 'Admin grants are not enabled');
  }
}

export interface AdminGrantInput {
  userId: string;
  amount: number;
  /** Operator-supplied, and the basis of the idempotency key. */
  reference: string;
  reason: string;
}

export async function grantTokensAsAdmin(
  input: AdminGrantInput,
): Promise<MutationResult> {
  if (!Number.isInteger(input.amount) || input.amount === 0) {
    throw new PlatformError('INVALID_INPUT', 'Grant amount must be a non-zero integer');
  }
  if (input.reference.trim().length < 4) {
    throw new PlatformError(
      'INVALID_INPUT',
      'A grant reference of at least 4 characters is required, so the grant can be traced',
    );
  }

  const wallet = await getTokenWallet();
  const result = await wallet.grant({
    userId: input.userId,
    amount: input.amount,
    // A negative operator correction is an adjustment; a positive one is a
    // grant. The database enforces the same rule.
    type: input.amount > 0 ? 'admin_grant' : 'adjustment',
    idempotencyKey: adminGrantKey(input.reference),
    description: input.reason,
    metadata: { reference: input.reference },
  });

  logger.info('tokens.admin_grant', {
    userId: input.userId,
    amount: input.amount,
    reference: input.reference,
    replayed: result.replayed,
    availableAfter: result.available,
  });

  return result;
}
