'use client';
import { createAuthClient } from './client';
import { mapAuthError, type MappedAuthError } from './errors';
import { ERROR_COPY } from '@/lib/errors';

/**
 * Every authentication call the browser makes, in one place.
 *
 * The forms below used to each call `supabase.auth.*` directly and each invent
 * their own error handling, which is how a 429 ended up rendered as "we could
 * not send that link". Routing all of them through here means the error mapping
 * is written once and the copy is the same wherever a failure surfaces.
 *
 * Note what these functions return: a result object, never a thrown error and
 * never a Supabase object. A caller cannot accidentally render an upstream
 * message, because it never has one.
 */

export interface AuthResult {
  ok: boolean;
  /** Present only when ok is false. */
  failure?: MappedAuthError & { title: string; body: string };
}

const OK: AuthResult = { ok: true };

function fail(error: unknown): AuthResult {
  const mapped = mapAuthError(error);
  const copy = ERROR_COPY[mapped.code];
  return { ok: false, failure: { ...mapped, title: copy.title, body: copy.body } };
}

/**
 * Where an email link should come back to.
 *
 * Built from the current origin so a preview deployment links to itself rather
 * than to production. The path is `/auth/confirm`, matching the email templates
 * — see the dashboard checklist in ARCHITECTURE.md.
 */
function confirmUrl(next?: string): string {
  const url = new URL('/auth/confirm', window.location.origin);
  if (next) url.searchParams.set('next', next);
  return url.toString();
}

/**
 * Creates an account and sends a verification link.
 *
 * Uses signInWithOtp rather than signUp because this flow collects a password
 * *after* verification. signUp demands one up front, which would mean writing a
 * throwaway random password and leaving anyone who abandons the flow able to
 * reach their account only through password recovery.
 */
export async function requestSignUpLink(email: string): Promise<AuthResult> {
  try {
    const { error } = await createAuthClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: confirmUrl('/auth/set-password'),
      },
    });
    return error ? fail(error) : OK;
  } catch (error) {
    return fail(error);
  }
}

/**
 * Sends a sign-in link to an existing account.
 *
 * `shouldCreateUser: false` is the difference from the call above: a typo in
 * the address on the sign-in page must not silently create a second account
 * that then holds its own token wallet.
 */
export async function requestSignInLink(
  email: string,
  next?: string,
): Promise<AuthResult> {
  try {
    const { error } = await createAuthClient().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: confirmUrl(next) },
    });
    return error ? fail(error) : OK;
  } catch (error) {
    return fail(error);
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const { error } = await createAuthClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    return error ? fail(error) : OK;
  } catch (error) {
    return fail(error);
  }
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  try {
    const { error } = await createAuthClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: confirmUrl('/auth/reset-password'),
    });
    return error ? fail(error) : OK;
  } catch (error) {
    return fail(error);
  }
}

/**
 * Sets the password on the session that already exists.
 *
 * Reachable only after /auth/confirm has verified a link, which is what makes
 * this safe without asking for the old password: possession of the mailbox has
 * already been proved on this request. The plaintext goes to Supabase and
 * nowhere else — this application has no password column and never sees a hash.
 */
export async function setPassword(password: string): Promise<AuthResult> {
  try {
    const { error } = await createAuthClient().auth.updateUser({ password });
    return error ? fail(error) : OK;
  } catch (error) {
    return fail(error);
  }
}
