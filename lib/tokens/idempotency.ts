import { createHash } from 'node:crypto';

/**
 * Idempotency keys for token mutations.
 *
 * Every mutation needs one, and the shape of the key decides what "the same
 * operation" means. Getting that wrong in either direction is expensive: too
 * specific and a double-click charges twice, too general and two genuinely
 * different jobs collide and the second is silently skipped.
 *
 * The scheme:
 *
 *   reserve   the client's submission id. One click, one id, one reservation —
 *             a retried click reuses it and replays instead of charging again.
 *   settle    derived from the job, because settlement is a server decision
 *             with no client token behind it. Finalise and refund use distinct
 *             prefixes so a job cannot both settle and refund under one key and
 *             have the second silently swallowed as a replay.
 *
 * Keys are prefixed rather than hashed wholesale so an operator reading the
 * ledger can tell what a row was for.
 */

/** Postgres constrains the column to 8–200 characters. */
export const MAX_KEY_LENGTH = 200;
export const MIN_KEY_LENGTH = 8;

function truncate(value: string): string {
  if (value.length <= MAX_KEY_LENGTH) return value;
  // Hash the tail rather than dropping it: two long keys sharing a prefix must
  // not collapse into one.
  const digest = createHash('sha256').update(value).digest('hex').slice(0, 32);
  return `${value.slice(0, MAX_KEY_LENGTH - 33)}.${digest}`;
}

export function reservationKey(submissionId: string): string {
  return truncate(`reserve:${submissionId}`);
}

export function finalizeKey(jobId: string): string {
  return truncate(`finalize:${jobId}`);
}

export function refundKey(jobId: string): string {
  return truncate(`refund:${jobId}`);
}

export function adminGrantKey(reference: string): string {
  return truncate(`grant:${reference}`);
}

/** Whether a client-supplied submission id is acceptable as a key component. */
export function isValidSubmissionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 8 &&
    value.length <= 100 &&
    /^[A-Za-z0-9_-]+$/.test(value)
  );
}
