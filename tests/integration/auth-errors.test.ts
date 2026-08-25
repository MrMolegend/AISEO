import { describe, it, expect } from 'vitest';
import { AuthApiError, AuthRetryableFetchError, AuthError } from '@supabase/supabase-js';
import { mapAuthError, isCooldown, EMAIL_COOLDOWN_SECONDS } from '@/lib/auth/errors';
import { ERROR_COPY } from '@/lib/errors';
import { isSafeReturnPath, signInPath } from '@/lib/auth/server';

/**
 * The messages a user actually reads when signing in fails.
 *
 * Every failure used to become "We could not send that link. Please try again
 * in a moment." — including the 429 that was telling them to stop. That single
 * sentence turned one broken callback into a retry loop, and gave nobody
 * anything to act on.
 *
 * These tests care about two things: that each Supabase failure produces copy
 * that says what to do, and that nothing Supabase wrote ever reaches a screen.
 */

describe('the rate limit that caused the retry loop', () => {
  it('says wait, and says it in the words the product requires', () => {
    const mapped = mapAuthError(
      new AuthApiError('email rate limit exceeded', 429, 'over_email_send_rate_limit'),
    );

    expect(mapped.code).toBe('AUTH_EMAIL_RATE_LIMITED');
    expect(ERROR_COPY[mapped.code].body).toBe(
      "You've already requested an email. Please wait before requesting another.",
    );
  });

  it('carries a cooldown, so the UI can count rather than invite another try', () => {
    const mapped = mapAuthError(
      new AuthApiError('rate limited', 429, 'over_email_send_rate_limit'),
    );

    expect(isCooldown(mapped)).toBe(true);
    expect(mapped.cooldownSeconds).toBe(EMAIL_COOLDOWN_SECONDS);
  });

  it('treats any 429 as a rate limit, whatever Supabase calls it next', () => {
    // The code strings are not part of a stable contract; the status is.
    const mapped = mapAuthError(new AuthApiError('slow down', 429, 'some_future_code'));
    expect(mapped.code).toBe('AUTH_EMAIL_RATE_LIMITED');
    expect(isCooldown(mapped)).toBe(true);
  });
});

describe('every failure a user can cause', () => {
  it.each([
    ['invalid_credentials', 'AUTH_INVALID_CREDENTIALS'],
    ['email_not_confirmed', 'AUTH_EMAIL_NOT_VERIFIED'],
    ['otp_expired', 'AUTH_LINK_INVALID'],
    ['weak_password', 'AUTH_WEAK_PASSWORD'],
    ['same_password', 'AUTH_PASSWORD_UNCHANGED'],
    ['email_exists', 'AUTH_ACCOUNT_EXISTS'],
    ['user_already_exists', 'AUTH_ACCOUNT_EXISTS'],
    ['email_address_invalid', 'AUTH_EMAIL_INVALID'],
    ['signup_disabled', 'AUTH_SIGNUP_DISABLED'],
    ['session_expired', 'AUTH_LINK_INVALID'],
  ])('%s → %s', (supabaseCode, expected) => {
    const mapped = mapAuthError(new AuthApiError('upstream text', 400, supabaseCode));

    expect(mapped.code).toBe(expected);
    // Every one of these must have real copy, not a placeholder.
    expect(ERROR_COPY[mapped.code].title.length).toBeGreaterThan(8);
    expect(ERROR_COPY[mapped.code].body.length).toBeGreaterThan(20);
  });

  it('does not say which half of a wrong sign-in was wrong', () => {
    // "That password is wrong" confirms the account exists to anyone guessing.
    const body = ERROR_COPY.AUTH_INVALID_CREDENTIALS.body.toLowerCase();
    expect(body).not.toMatch(/no account|not registered|does not exist|unknown email/);
  });
});

describe('failures nobody caused', () => {
  it('maps a dropped request to a network failure, not a credential problem', () => {
    const mapped = mapAuthError(new AuthRetryableFetchError('Failed to fetch', 0));
    expect(mapped.code).toBe('AUTH_NETWORK');
  });

  it('maps a blocked fetch the same way', () => {
    // A CSP that forbids the Supabase origin rejects with a TypeError — which
    // is exactly how the original outage presented in the browser.
    const mapped = mapAuthError(new TypeError('Failed to fetch'));
    expect(mapped.code).toBe('AUTH_NETWORK');
  });

  it('falls back to UNKNOWN rather than guessing', () => {
    expect(mapAuthError(new Error('something else')).code).toBe('UNKNOWN');
    expect(mapAuthError('a string').code).toBe('UNKNOWN');
    expect(mapAuthError(null).code).toBe('UNKNOWN');
    expect(mapAuthError(undefined).code).toBe('UNKNOWN');
  });
});

describe('nothing from Supabase reaches the user', () => {
  const UPSTREAM = [
    'AuthApiError: Invalid login credentials at /auth/v1/token?grant_type=password',
    'relation "auth.users" does not exist',
    'JWSError JWSInvalidSignature',
  ];

  it.each(UPSTREAM)('never surfaces: %s', (message) => {
    const mapped = mapAuthError(new AuthApiError(message, 400, 'invalid_credentials'));
    const copy = ERROR_COPY[mapped.code];

    expect(copy.title).not.toContain(message);
    expect(copy.body).not.toContain(message);
    // Nor any of the shapes an internal message is made of.
    for (const shape of ['auth.users', '/auth/v1/', 'JWS', 'AuthApiError', 'relation']) {
      expect(`${copy.title} ${copy.body}`).not.toContain(shape);
    }
  });

  it('produces no copy mentioning the provider at all', () => {
    const authCodes = Object.keys(ERROR_COPY).filter((code) => code.startsWith('AUTH_'));
    expect(authCodes.length).toBeGreaterThan(8);

    for (const code of authCodes) {
      const copy = ERROR_COPY[code as keyof typeof ERROR_COPY];
      const text = `${copy.title} ${copy.body}`.toLowerCase();
      expect(text).not.toContain('supabase');
      expect(text).not.toContain('jwt');
      expect(text).not.toContain('token_hash');
      expect(text).not.toMatch(/\b(4\d\d|5\d\d)\b/); // no bare status codes
    }
  });
});

describe('the redirect target cannot leave the site', () => {
  it.each([
    ['protocol relative', '//evil.test'],
    ['backslash', '/\\evil.test'],
    ['absolute http', 'https://evil.test/x'],
    ['scheme', 'javascript:alert(1)'],
    ['no leading slash', 'dashboard'],
    ['empty', ''],
    ['newline', '/dashboard\nLocation: https://evil.test'],
    ['carriage return', '/dashboard\r\nSet-Cookie: a=b'],
    ['auth loop', '/auth/confirm'],
    ['too long', `/${'a'.repeat(600)}`],
  ])('rejects %s', (_name, value) => {
    expect(isSafeReturnPath(value)).toBe(false);
    // And signInPath falls back rather than embedding it.
    expect(signInPath(value)).toBe('/sign-in');
  });

  it.each(['/dashboard', '/wallet', '/research/new/lead-finder', '/research/abc123'])(
    'accepts %s',
    (value) => {
      expect(isSafeReturnPath(value)).toBe(true);
      expect(signInPath(value)).toBe(`/sign-in?next=${encodeURIComponent(value)}`);
    },
  );

  it('rejects a null or undefined target without throwing', () => {
    expect(isSafeReturnPath(null)).toBe(false);
    expect(isSafeReturnPath(undefined)).toBe(false);
    expect(signInPath(undefined)).toBe('/sign-in');
  });
});

describe('the AuthError base class', () => {
  it('is handled even when it is not an API error', () => {
    // AuthError covers several subclasses; none of them should fall through to
    // a raw message.
    const mapped = mapAuthError(new AuthError('generic auth failure'));
    expect(mapped.code).toBe('AUTH_NETWORK');
    expect(ERROR_COPY[mapped.code]).toBeDefined();
  });
});
