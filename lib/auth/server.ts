import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getEnv, hasSupabaseAuth, supabasePublishableKey } from '@/lib/env';
import { PlatformError } from '@/lib/errors';

/**
 * Server-side identity.
 *
 * The one rule this module exists to enforce: a user id is never taken from the
 * browser. Not from a header, not from a body field, not from a query
 * parameter. It comes from a token whose signature has been verified here, on
 * the server, on this request.
 *
 * That is why `getClaims()` is used rather than `getSession()`. getSession
 * reads the cookie and decodes it without checking that anyone actually issued
 * it — trusting it server-side means trusting whatever the browser sent.
 * getClaims validates the JWT signature against the project's published keys
 * every time.
 */

export interface AuthenticatedUser {
  id: string;
  email: string | null;
}

/**
 * A Supabase client bound to this request's cookies.
 *
 * A new client per request is correct and intended: on the server the client is
 * essentially a configured fetch, and the configuration is this request's
 * cookies. Reusing one across requests would mean reusing one user's session.
 */
export async function createServerAuthClient() {
  const env = getEnv();
  const key = supabasePublishableKey(env);

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    throw new PlatformError('AUTH_REQUIRED', 'Supabase auth is not configured');
  }

  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session on every request, so there is nothing to recover here.
        }
      },
    },
  });
}

/**
 * The signed-in user, or null.
 *
 * Returns null rather than throwing when auth is not configured at all, so a
 * developer without Supabase credentials still gets a working logged-out site
 * instead of a crash on every page.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  if (!hasSupabaseAuth()) return null;

  try {
    const supabase = await createServerAuthClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;

    const claims = data.claims as { sub?: unknown; email?: unknown };
    if (typeof claims.sub !== 'string' || claims.sub.length === 0) return null;

    return {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
    };
  } catch {
    // An expired or malformed token is a logged-out user, not an error page.
    return null;
  }
}

/**
 * The signed-in user, or a typed failure.
 *
 * Used by anything that must not proceed anonymously. Route handlers map the
 * error to a 401; pages redirect to sign-in with a return path.
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new PlatformError('AUTH_REQUIRED', 'No authenticated user on this request');
  }
  return user;
}

/**
 * Builds the sign-in URL that returns to where the user was going.
 *
 * `next` is validated on the way back in (see app/auth/callback/route.ts): an
 * open redirect through a sign-in flow is a phishing primitive, and the fix is
 * to only ever accept a same-site path.
 */
export function signInPath(returnTo?: string): string {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return '/sign-in';
  }
  return `/sign-in?next=${encodeURIComponent(returnTo)}`;
}

/** Whether a redirect target is a safe same-site path. */
export function isSafeReturnPath(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}
