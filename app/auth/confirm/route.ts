import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { isSafeReturnPath, siteOrigin } from '@/lib/auth/server';
import {
  getEnv,
  hasSupabaseAuth,
  supabasePublishableKey,
  welcomeTokenGrant,
} from '@/lib/env';
import { getTokenWallet } from '@/lib/tokens';
import { mapAuthError } from '@/lib/auth/errors';
import { logger } from '@/lib/observability/logger';

/**
 * Where every email link lands.
 *
 * ── Why this route owns its response object ──────────────────────────────
 *
 * Production symptom: Supabase's logs showed the link verified successfully,
 * the browser came back to the site, and the application did not have a
 * session. The old route built its Supabase client from `cookies()` and then
 * returned a separately-constructed redirect, relying on Next to merge the two.
 * Next 16 does do that merge — but the write was wrapped in a silent
 * `try {} catch {}`, so if it ever failed there was no session, no error and no
 * log line. An auth callback whose only failure mode is invisible is not one
 * worth keeping.
 *
 * So the redirect is created first and the cookie adapter writes onto *it*.
 * The session cookies and the anti-cache headers are on the object we return,
 * by construction, with nothing in between to lose them. It also makes the
 * route testable without a Next request store, which is how the regression test
 * in tests/integration/auth-confirm.test.ts can assert the real Set-Cookie
 * headers rather than a mock's say-so.
 *
 * ── Why token_hash rather than a PKCE code ───────────────────────────────
 *
 * `verifyOtp` needs nothing from the browser that requested the link. The PKCE
 * flow does: it needs the code-verifier cookie, which lives only in the browser
 * that started the sign-in. Mail apps open links in their own in-app webview,
 * which has no access to it — so the exchange failed *after* Supabase had
 * already recorded the login. That is the exact split the logs showed, and it
 * cannot be fixed in code while the flow is PKCE.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Types Supabase can send us. Anything else is a link we did not issue. */
const ACCEPTED_TYPES: readonly EmailOtpType[] = [
  'signup',
  'magiclink',
  'recovery',
  'invite',
  'email',
  'email_change',
];

function isAcceptedType(value: string | null): value is EmailOtpType {
  return value !== null && (ACCEPTED_TYPES as readonly string[]).includes(value);
}

/** Where a given link type should land when it carries no explicit `next`. */
function defaultDestination(type: EmailOtpType): string {
  if (type === 'recovery') return '/auth/reset-password';
  if (type === 'signup' || type === 'invite') return '/auth/set-password';
  return '/dashboard';
}

function errorRedirect(origin: string, reason: string): NextResponse {
  return NextResponse.redirect(`${origin}/auth/error?reason=${reason}`);
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = siteOrigin(request);

  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  const next = searchParams.get('next');

  if (!isAcceptedType(rawType)) {
    // No type at all usually means an email client mangled the link.
    return errorRedirect(origin, tokenHash ? 'invalid' : 'incomplete');
  }
  if (!tokenHash) {
    return errorRedirect(origin, 'incomplete');
  }

  const env = getEnv();
  const key = supabasePublishableKey(env);
  if (!hasSupabaseAuth(env) || !env.NEXT_PUBLIC_SUPABASE_URL || !key) {
    logger.error('auth.confirm_unconfigured', {});
    return errorRedirect(origin, 'unavailable');
  }

  const destination = isSafeReturnPath(next) ? next : defaultDestination(rawType);

  /*
   * Built before the client, because the client writes into it.
   *
   * `NextResponse.redirect` returns a response whose `.cookies` writer appends
   * straight to its own headers, so every cookie Supabase produces is on the
   * object this function returns — not on a request-scoped store that something
   * downstream has to remember to merge.
   */
  const response = NextResponse.redirect(`${origin}${destination}`);

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control: private, no-store / Expires: 0 / Pragma: no-cache.
        // A redirect carrying a Set-Cookie for someone's session must never be
        // cached by a CDN, or the next visitor is handed that session.
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  try {
    const { error } = await supabase.auth.verifyOtp({
      type: rawType,
      token_hash: tokenHash,
    });

    if (error) {
      // Never logs token_hash: it is a single-use credential, and a log line is
      // the one place a used link outlives its use.
      const mapped = mapAuthError(error);
      logger.warn('auth.confirm_rejected', { type: rawType, code: mapped.code });
      return errorRedirect(
        origin,
        mapped.code === 'AUTH_LINK_INVALID' ? 'expired' : 'invalid',
      );
    }

    // The session exists now. getClaims verifies the JWT signature rather than
    // trusting what was just written.
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (typeof userId === 'string' && userId.length > 0) {
      try {
        const wallet = await getTokenWallet();
        await wallet.bootstrap(userId, { welcomeTokens: welcomeTokenGrant(env) });
      } catch (bootstrapError) {
        // A missing wallet row is recoverable on the next request; a failed
        // sign-in is not. Log it and let the user in.
        logger.error('auth.bootstrap_failed', {
          userId,
          error: String(bootstrapError),
        });
      }
    }

    logger.info('auth.confirmed', { type: rawType, destination });
    return response;
  } catch (error) {
    logger.error('auth.confirm_failed', {
      type: rawType,
      error: String(mapAuthError(error).code),
    });
    return errorRedirect(origin, 'unavailable');
  }
}
