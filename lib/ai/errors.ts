import { AuditError, type AuditErrorCode } from '@/lib/errors';

/**
 * Maps provider failures onto the audit error taxonomy.
 *
 * Kept separate from the provider so a second provider inherits the same
 * classification rather than inventing its own.
 */
export function classifyProviderError(error: unknown): AuditError {
  if (error instanceof AuditError) return error;

  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status: unknown }).status)
      : null;

  const message = error instanceof Error ? error.message : String(error);

  let code: AuditErrorCode = 'AI_UNAVAILABLE';

  if (status === 429) code = 'AI_RATE_LIMITED';
  else if (status === 401 || status === 403) code = 'AI_UNAVAILABLE';
  else if (status === 400) code = 'AI_INVALID_OUTPUT';
  else if (status !== null && status >= 500) code = 'AI_UNAVAILABLE';
  else if (/abort|timeout|timed out/i.test(message)) code = 'AI_TIMEOUT';

  return new AuditError(code, message, { cause: error, context: { status } });
}

/** Whether a failure is worth another attempt. */
export function isRetryable(error: AuditError): boolean {
  return error.code === 'AI_UNAVAILABLE' || error.code === 'AI_RATE_LIMITED';
}
