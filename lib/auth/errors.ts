import { AuthError, isAuthApiError } from '@supabase/supabase-js';
import { type ErrorCode } from '@/lib/errors';

/**
 * Supabase auth failures, translated.
 *
 * Every sign-in failure used to collapse into one sentence — "We could not send
 * that link. Please try again in a moment." — which is what users saw when they
 * were in fact being rate limited, and is why they kept retrying into a 429.
 * A message that cannot distinguish "wait 60 seconds" from "your password is
 * wrong" is not an error message, it is a shrug.
 *
 * The mapping is exhaustive rather than guessed: @supabase/auth-js exports a
 * typed union of its error codes, so the strings below are checked against the
 * SDK rather than copied from a blog post. Anything unrecognised falls through
 * to a generic code — never to the raw Supabase text, which is written for a
 * developer and can name internal endpoints.
 */

/**
 * How long to refuse another email after a rate limit.
 *
 * Supabase's own default is 60 seconds between emails, and its 429 does not
 * carry a Retry-After we can read, so the countdown is derived from that
 * documented default rather than invented per call site.
 */
export const EMAIL_COOLDOWN_SECONDS = 60;

/** Supabase error codes we have specific copy for. */
const CODE_MAP: Record<string, ErrorCode> = {
  over_email_send_rate_limit: 'AUTH_EMAIL_RATE_LIMITED',
  over_request_rate_limit: 'AUTH_EMAIL_RATE_LIMITED',
  invalid_credentials: 'AUTH_INVALID_CREDENTIALS',
  email_not_confirmed: 'AUTH_EMAIL_NOT_VERIFIED',
  otp_expired: 'AUTH_LINK_INVALID',
  otp_disabled: 'AUTH_LINK_INVALID',
  bad_jwt: 'AUTH_LINK_INVALID',
  session_expired: 'AUTH_LINK_INVALID',
  session_not_found: 'AUTH_LINK_INVALID',
  refresh_token_not_found: 'AUTH_LINK_INVALID',
  refresh_token_already_used: 'AUTH_LINK_INVALID',
  flow_state_expired: 'AUTH_LINK_INVALID',
  flow_state_not_found: 'AUTH_LINK_INVALID',
  weak_password: 'AUTH_WEAK_PASSWORD',
  same_password: 'AUTH_PASSWORD_UNCHANGED',
  email_exists: 'AUTH_ACCOUNT_EXISTS',
  user_already_exists: 'AUTH_ACCOUNT_EXISTS',
  email_address_invalid: 'AUTH_EMAIL_INVALID',
  email_address_not_authorized: 'AUTH_EMAIL_INVALID',
  validation_failed: 'AUTH_EMAIL_INVALID',
  signup_disabled: 'AUTH_SIGNUP_DISABLED',
  email_provider_disabled: 'AUTH_SIGNUP_DISABLED',
  user_banned: 'AUTH_INVALID_CREDENTIALS',
  user_not_found: 'AUTH_INVALID_CREDENTIALS',
};

export interface MappedAuthError {
  code: ErrorCode;
  /** Seconds the caller must wait before offering to retry. Zero when free. */
  cooldownSeconds: number;
}

/**
 * Maps whatever came back from Supabase onto our taxonomy.
 *
 * Takes `unknown` deliberately. Callers sit in `catch` blocks and around SDK
 * calls that return `{ error }` rather than throwing, and a mapper that only
 * accepted `AuthError` would push a type guard to every one of them — where it
 * would eventually be forgotten and a raw message would reach a user.
 */
export function mapAuthError(error: unknown): MappedAuthError {
  const rateLimited = (code: ErrorCode): MappedAuthError => ({
    code,
    cooldownSeconds: code === 'AUTH_EMAIL_RATE_LIMITED' ? EMAIL_COOLDOWN_SECONDS : 0,
  });

  if (error instanceof AuthError) {
    const mapped = error.code ? CODE_MAP[error.code] : undefined;
    if (mapped) return rateLimited(mapped);

    // A 429 with a code we do not recognise is still a rate limit, and telling
    // the user to wait is right whatever Supabase decides to call it next.
    if (isAuthApiError(error) && error.status === 429) {
      return rateLimited('AUTH_EMAIL_RATE_LIMITED');
    }
    if (isAuthApiError(error) && error.status === 401) {
      return rateLimited('AUTH_INVALID_CREDENTIALS');
    }
    // AuthRetryableFetchError and friends: the request never got an answer.
    if (!isAuthApiError(error)) return rateLimited('AUTH_NETWORK');

    return rateLimited('UNKNOWN');
  }

  // fetch() rejects with a TypeError when the network is down or, notably, when
  // the Content-Security-Policy blocks the request — which is precisely the
  // failure that produced the original generic message.
  if (error instanceof TypeError) return rateLimited('AUTH_NETWORK');

  return rateLimited('UNKNOWN');
}

/**
 * Whether a mapped failure should offer a countdown rather than a retry button.
 *
 * A retry button on a rate limit is an invitation to make it worse.
 */
export function isCooldown(mapped: MappedAuthError): boolean {
  return mapped.cooldownSeconds > 0;
}
