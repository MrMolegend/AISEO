import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getEnv, hasSupabaseAuth, supabasePublishableKey } from '@/lib/env';
import { siteOrigin } from '@/lib/auth/server';
import { TEST_SESSION_COOKIE } from '@/lib/auth/test-driver';
import { logger } from '@/lib/observability/logger';

/**
 * Signing out, on the server.
 *
 * POST rather than GET, and a real form rather than a fetch, for three reasons.
 * A GET that destroys a session can be triggered by any `<img src>` on any page
 * — sign-out CSRF is minor but free to avoid. A form works with JavaScript
 * disabled or still loading. And doing it on the server means the session is
 * revoked at Supabase, not merely forgotten by this browser: the old approach
 * called `signOut()` in the client and cleared `document.cookie`, which leaves
 * the refresh token valid for anyone who copied it.
 *
 * Like the confirm route, this builds its redirect first and lets the cookie
 * adapter clear cookies on that exact object. The server-rendered header reads
 * its user from cookies, so by the time the browser follows this redirect the
 * signed-out state is already true — there is no window where the page says one
 * thing and the session says another.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const origin = siteOrigin(request);

  // `signed-out` is what makes /?signed-out=1 show the confirmation. A redirect
  // on its own is not evidence to a user that anything happened.
  const response = NextResponse.redirect(`${origin}/?signed-out=1`, {
    // 303: the browser must follow a POST redirect with GET, or it re-posts.
    status: 303,
  });

  /*
   * Cleared first, and unconditionally.
   *
   * This used to sit after the "is Supabase configured?" check, which meant a
   * deployment without credentials — or one running the end-to-end suite's
   * stand-in driver — returned the redirect with the session cookie still
   * intact. The user was told they had signed out and had not.
   *
   * Clearing is local and cannot fail. Revoking upstream can, so it goes
   * second: whatever happens there, the browser leaves without a session.
   */
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('sb-') || cookie.name === TEST_SESSION_COOKIE) {
      response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 });
    }
  }

  const env = getEnv();
  const key = supabasePublishableKey(env);

  if (!hasSupabaseAuth(env) || !env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    return response;
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // On sign-out these arrive with an expiry in the past, which is what
        // clears them. Same writer as the confirm route: onto the response we
        // are actually returning.
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  try {
    await supabase.auth.signOut();
  } catch (error) {
    // The user asked to leave. Whatever went wrong upstream, they leave: the
    // cookies are cleared below regardless, so the worst case is a session that
    // stays valid at Supabase until it expires rather than a user stuck signed
    // in on their own machine.
    logger.warn('auth.sign_out_failed', { error: String(error) });
  }

  return response;
}
