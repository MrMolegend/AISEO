import { describe, expect, it } from 'vitest';
import {
  AUDIT_ERROR_CODES,
  AUDIT_ERROR_COPY,
  AuditError,
  isAuditError,
  renderErrorCopy,
  toAuditError,
} from '@/lib/errors';

/**
 * The error taxonomy is what stands between a user and a stack trace. A code
 * without copy would render as an empty error state — visible only if that exact
 * failure happened in front of someone.
 */
describe('error taxonomy', () => {
  it.each(AUDIT_ERROR_CODES)('%s has complete, user-ready copy', (code) => {
    const copy = AUDIT_ERROR_COPY[code];
    expect(copy, `${code} has no copy`).toBeDefined();
    expect(copy.title.length).toBeGreaterThan(5);
    expect(copy.body.length).toBeGreaterThan(20);
    expect(typeof copy.retryable).toBe('boolean');
    expect(copy.status).toBeGreaterThanOrEqual(400);
    expect(copy.status).toBeLessThan(600);
  });

  it('never exposes a raw code or placeholder in user-facing copy', () => {
    for (const code of AUDIT_ERROR_CODES) {
      const copy = AUDIT_ERROR_COPY[code];
      // {domain} is the only placeholder, and renderErrorCopy substitutes it.
      const rendered = renderErrorCopy(code, 'example.com');
      expect(rendered.title).not.toMatch(/\{[a-z]+\}/i);
      expect(rendered.body).not.toMatch(/\{[a-z]+\}/i);
      expect(copy.title).not.toContain('_');
    }
  });

  it('substitutes the domain, and falls back gracefully without one', () => {
    const withDomain = renderErrorCopy('SITE_UNREACHABLE', 'example.com');
    expect(withDomain.title).toContain('example.com');

    const without = renderErrorCopy('SITE_UNREACHABLE', null);
    expect(without.title).toContain('the site');
    expect(without.title).not.toContain('{domain}');
  });
});

describe('AuditError', () => {
  it('carries its code, copy and status', () => {
    const error = new AuditError('RATE_LIMITED', 'internal detail');
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.status).toBe(429);
    expect(error.copy.title.length).toBeGreaterThan(0);
  });

  it('keeps internal context off the user-facing copy', () => {
    const error = new AuditError('SITE_BLOCKED', 'connect ECONNREFUSED 10.0.0.5:443', {
      context: { internalHost: 'db.internal' },
    });
    expect(error.copy.body).not.toContain('10.0.0.5');
    expect(error.copy.body).not.toContain('db.internal');
  });

  it('coerces an unknown throw into UNKNOWN rather than leaking it', () => {
    const coerced = toAuditError(new TypeError('cannot read property x of undefined'));
    expect(coerced.code).toBe('UNKNOWN');
    expect(coerced.copy.body).not.toContain('cannot read property');
  });

  it('passes an existing AuditError through unchanged', () => {
    const original = new AuditError('AI_TIMEOUT');
    expect(toAuditError(original)).toBe(original);
  });

  it('is identifiable across module boundaries', () => {
    expect(isAuditError(new AuditError('UNKNOWN'))).toBe(true);
    expect(isAuditError(new Error('plain'))).toBe(false);
    expect(isAuditError('a string')).toBe(false);
  });
});
