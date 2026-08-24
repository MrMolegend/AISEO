import { NextResponse, type NextRequest } from 'next/server';
import { createServerAuthClient, isSafeReturnPath } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { welcomeTokenGrant } from '@/lib/env';
import { logger } from '@/lib/observability/logger';

/**
 * Where a magic link lands.
 *
 * Exchanges the one-time code for a session, bootstraps the account, then
 * redirects.
 *
 * The redirect target is validated as a same-site path. An auth flow that will
 * bounce a freshly-signed-in user to an arbitrary URL is a phishing primitive:
 * the victim really is signed in, and the attacker's page really did receive
 * them from a legitimate domain.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  const destination = isSafeReturnPath(next) ? next : '/dashboard';

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/verify?state=missing`);
  }

  try {
    const supabase = await createServerAuthClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // Expired, already used, or issued for a different browser. All three
      // look the same to the person holding the link, and all three are fixed
      // by asking for a new one.
      return NextResponse.redirect(`${origin}/auth/verify?state=expired`);
    }

    // Create the profile and wallet on first arrival. Idempotent, so running it
    // on every sign-in costs one query and removes a whole class of "account
    // exists but has no wallet" states.
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;

    if (typeof userId === 'string') {
      try {
        const wallet = await getTokenWallet();
        await wallet.bootstrap(userId, { welcomeTokens: welcomeTokenGrant() });
      } catch (bootstrapError) {
        // A failed bootstrap must not block sign-in. The wallet page creates it
        // on next read, and the balance is zero either way.
        logger.error('auth.bootstrap_failed', {
          userId,
          error: String(bootstrapError),
        });
      }
    }

    return NextResponse.redirect(`${origin}${destination}`);
  } catch (error) {
    logger.error('auth.callback_failed', { error: String(error) });
    return NextResponse.redirect(`${origin}/auth/verify?state=error`);
  }
}
