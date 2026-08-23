import { describe, expect, it } from 'vitest';
import {
  ERROR_CODES,
  ERROR_COPY,
  PlatformError,
  isPlatformError,
  refundsTokens,
  renderErrorCopy,
  toPlatformError,
} from '@/lib/errors';

/**
 * The error taxonomy is what stands between a user and a stack trace. A code
 * without copy would render as an empty error state — visible only if that exact
 * failure happened in front of someone.
 */
describe('error taxonomy', () => {
  it.each(ERROR_CODES)('%s has complete, user-ready copy', (code) => {
    const copy = ERROR_COPY[code];
    expect(copy, `${code} has no copy`).toBeDefined();
    expect(copy.title.length).toBeGreaterThan(5);
    expect(copy.body.length).toBeGreaterThan(20);
    expect(typeof copy.retryable).toBe('boolean');
    expect(copy.status).toBeGreaterThanOrEqual(400);
    expect(copy.status).toBeLessThan(600);
  });

  it('never exposes a raw code or placeholder in user-facing copy', () => {
    for (const code of ERROR_CODES) {
      const copy = ERROR_COPY[code];
      // {subject} is the only placeholder, and renderErrorCopy substitutes it.
      const rendered = renderErrorCopy(code, 'example.com');
      expect(rendered.title).not.toMatch(/\{[a-z]+\}/i);
      expect(rendered.body).not.toMatch(/\{[a-z]+\}/i);
      expect(copy.title).not.toContain('_');
    }
  });

  it('substitutes the subject, and falls back gracefully without one', () => {
    const withSubject = renderErrorCopy('SITE_UNREACHABLE', 'example.com');
    expect(withSubject.title).toContain('example.com');

    const without = renderErrorCopy('SITE_UNREACHABLE', null);
    expect(without.title).toContain('that site');
    expect(without.title).not.toContain('{subject}');
  });

  /**
   * The refund policy is data rather than a condition buried in the job runner,
   * so it is worth asserting the shape of it directly. The rule: we refund our
   * own failures and our suppliers', never the state of the public record, and
   * never where no reservation was made in the first place.
   */
  it('declares a refund decision for every code', () => {
    for (const code of ERROR_CODES) {
      expect(typeof ERROR_COPY[code].refundsTokens, code).toBe('boolean');
    }
  });

  it("refunds our failures and not the user's mistakes", () => {
    for (const code of [
      'AI_UNAVAILABLE',
      'AI_INVALID_OUTPUT',
      'RESEARCH_PROVIDER_UNAVAILABLE',
      'NO_RELIABLE_SOURCES',
      'STORAGE_ERROR',
      'JOB_TIMEOUT',
      'CRAWL_TIMEOUT',
      'UNKNOWN',
    ] as const) {
      expect(refundsTokens(code), `${code} should refund`).toBe(true);
    }

    // No reservation exists yet at validation time, and a rate limit or a
    // duplicate never started a job.
    for (const code of [
      'INVALID_INPUT',
      'AUTH_REQUIRED',
      'INSUFFICIENT_TOKENS',
      'DUPLICATE_SUBMISSION',
      'RATE_LIMITED',
      'INVALID_URL',
      'BLOCKED_URL',
    ] as const) {
      expect(refundsTokens(code), `${code} should not refund`).toBe(false);
    }
  });
});

describe('PlatformError', () => {
  it('carries its code, copy and status', () => {
    const error = new PlatformError('RATE_LIMITED', 'internal detail');
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.status).toBe(429);
    expect(error.copy.title.length).toBeGreaterThan(0);
  });

  it('keeps internal context off the user-facing copy', () => {
    const error = new PlatformError('SITE_BLOCKED', 'connect ECONNREFUSED 10.0.0.5:443', {
      context: { internalHost: 'db.internal' },
    });
    expect(error.copy.body).not.toContain('10.0.0.5');
    expect(error.copy.body).not.toContain('db.internal');
  });

  it('coerces an unknown throw into UNKNOWN rather than leaking it', () => {
    const coerced = toPlatformError(new TypeError('cannot read property x of undefined'));
    expect(coerced.code).toBe('UNKNOWN');
    expect(coerced.copy.body).not.toContain('cannot read property');
  });

  it('passes an existing PlatformError through unchanged', () => {
    const original = new PlatformError('AI_TIMEOUT');
    expect(toPlatformError(original)).toBe(original);
  });

  it('is identifiable across module boundaries', () => {
    expect(isPlatformError(new PlatformError('UNKNOWN'))).toBe(true);
    expect(isPlatformError(new Error('plain'))).toBe(false);
    expect(isPlatformError('a string')).toBe(false);
  });
});
