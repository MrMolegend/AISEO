import 'server-only';
import { toPlatformError } from '@/lib/errors';
import type { RateLimitVerdict } from '@/lib/security/rate-limit';
import { PlatformError } from '@/lib/errors';

/**
 * The one shape every API route answers in.
 *
 * Success bodies are the route's own; failures are always the platform
 * envelope — code, customer copy, retryability — and never the internal
 * message, which can carry hostnames and upstream detail. Having this in one
 * place is what keeps a new route from inventing its own error dialect.
 */

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export function errorResponse(error: unknown): Response {
  const platform = toPlatformError(error);
  return Response.json(
    {
      error: platform.code,
      title: platform.copy.title,
      message: platform.copy.body,
      retryable: platform.copy.retryable,
      ...(platform.context.issues ? { issues: platform.context.issues } : {}),
      ...(platform.context.retryAfterSeconds
        ? { retryAfterSeconds: platform.context.retryAfterSeconds }
        : {}),
    },
    { status: platform.status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/** Throws RATE_LIMITED when a window check came back exhausted. */
export function assertWithinLimit(verdict: RateLimitVerdict): void {
  if (verdict.allowed) return;
  throw new PlatformError('RATE_LIMITED', 'Too many requests for this action', {
    context: { retryAfterSeconds: verdict.retryAfterSeconds },
  });
}
