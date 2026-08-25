import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import {
  getEnv,
  hasSupabaseAuth,
  supabasePublishableKey,
  usingTestAuthDriver,
} from '@/lib/env';
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
export async function createServerAuthClient(responseHeaders?: Headers) {
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
      setAll(cookiesToSet, headers) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
          // @supabase/ssr hands us Cache-Control/Expires/Pragma alongside any
          // auth cookie. They are not decoration: without them a CDN can cache
          // a response carrying one user's session and serve it to the next
          // visitor. Server Components cannot set headers either, so this is
          // best-effort in the same way the cookie write is.
          for (const [header, value] of Object.entries(headers)) {
            responseHeaders?.set(header, value);
          }
        } catch {
          // Server Components cannot write cookies, and this is the expected
          // path for every RSC render: the proxy refreshes the session on the
          // request before it, so the write has already happened elsewhere.
          //
          // Route handlers CAN write, so a failure there would be real — but it
          // is also unreachable, because the routes that must persist a session
          // build their own response instead of relying on this client. See
          // app/auth/confirm/route.ts.
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
  // Tests only, and unreachable in production: usingTestAuthDriver() throws
  // rather than returning false if the flag is set under NODE_ENV=production.
  // See lib/auth/test-driver.ts.
  if (usingTestAuthDriver()) {
    const { getTestSessionUser } = await import('./test-driver');
    return getTestSessionUser();
  }

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
 * `next` is validated again on the way back in (see app/auth/confirm/route.ts):
 * an open redirect through a sign-in flow is a phishing primitive — the victim
 * genuinely signs in to the real site, then lands on the attacker's.
 */
export function signInPath(returnTo?: string): string {
  if (!isSafeReturnPath(returnTo)) return '/sign-in';
  return `/sign-in?next=${encodeURIComponent(returnTo)}`;
}

/**
 * Whether the sign-in forms should render at all.
 *
 * True when a real Supabase project is configured, and also when the test
 * driver is serving — otherwise the end-to-end suite would meet a "sign-in is
 * not available" panel on every auth page and never exercise the forms.
 * Resolved on the server so the browser bundle does not have to reason about
 * which driver is live.
 */
export function authAvailable(): boolean {
  return hasSupabaseAuth() || usingTestAuthDriver();
}

/**
 * The origin auth redirects are built against.
 *
 * Not `request.nextUrl.origin`. That is derived from the request's own headers,
 * and it is wrong in exactly the situations that matter: behind a proxy it
 * reflects whatever `Host` arrived, and Next normalises a loopback address to
 * `localhost` — which sent the end-to-end suite's sign-out redirect to a
 * different origin than the browser was on, so the browser simply did not
 * follow it. In production the same class of mismatch means a redirect to a
 * host the session cookie was not set for.
 *
 * NEXT_PUBLIC_SITE_URL is the canonical answer: it is configuration rather than
 * an attacker-influenced header, and it is the same value that has to be
 * registered as Supabase's Site URL for any of this to work at all. The request
 * origin is kept only as a fallback for a deployment that has not set it.
 */
export function siteOrigin(request: { nextUrl: { origin: string } }): string {
  const configured = getEnv().NEXT_PUBLIC_SITE_URL;
  return configured ? new URL(configured).origin : request.nextUrl.origin;
}

/** Longer than any route this application has, and short enough to log. */
const MAX_RETURN_PATH = 512;

/**
 * Whether a redirect target is a safe same-site path.
 *
 * The rules, and why each one is here:
 *
 *   · Must start with a single `/`. `//evil.com` and `/\evil.com` are both
 *     protocol-relative once a browser normalises them — the backslash form is
 *     the one that gets missed, and it is why this checks the second character
 *     rather than just the prefix.
 *   · No control characters. A newline in a Location header splits the
 *     response.
 *   · Not inside `/auth/`. Bouncing a freshly authenticated user back through
 *     the auth flow is at best a loop and at worst a way to replay a link.
 *   · Bounded length, so a hostile value cannot be used to bloat a redirect.
 */
export function isSafeReturnPath(value: string | null | undefined): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_RETURN_PATH) return false;
  if (value[0] !== '/') return false;
  if (value[1] === '/' || value[1] === String.fromCharCode(92)) return false;
  if (value.startsWith('/auth/')) return false;

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) return false;
  }

  return true;
}
