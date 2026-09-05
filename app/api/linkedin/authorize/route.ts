import { requireMember, recordAudit } from '@/lib/auth/membership';
import { buildAuthorizationUrl, generatePkce, generateState } from '@/lib/linkedin/oauth';
import { linkedInConfigured, linkedInMode } from '@/lib/linkedin/provider';
import { getEnv } from '@/lib/env';
import { PlatformError } from '@/lib/errors';
import { errorResponse } from '@/lib/api/respond';

/**
 * Begins the LinkedIn identity link for the signed-in member.
 *
 * State and the PKCE verifier are generated here and carried in one
 * short-lived HttpOnly cookie; the browser sees only the public
 * authorization URL. When the mode is disabled or unconfigured the route
 * answers 404 like any other absent surface.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_COOKIE = 'li-oauth';

export async function GET() {
  try {
    const { user } = await requireMember();
    if (linkedInMode() === 'disabled' || !linkedInConfigured()) {
      throw new PlatformError('NOT_FOUND', 'LinkedIn linking is not available');
    }

    const env = getEnv();
    const state = generateState();
    const { verifier, challenge } = generatePkce();

    const url = buildAuthorizationUrl({
      clientId: env.LINKEDIN_CLIENT_ID!,
      redirectUri: env.LINKEDIN_REDIRECT_URI!,
      state,
      codeChallenge: challenge,
    });

    await recordAudit(user.id, 'linkedin.link_started', 'provider_connection', user.id);

    const response = new Response(null, {
      status: 302,
      headers: { location: url },
    });
    response.headers.append(
      'set-cookie',
      `${OAUTH_COOKIE}=${encodeURIComponent(JSON.stringify({ state, verifier }))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${
        env.NODE_ENV === 'production' ? '; Secure' : ''
      }`,
    );
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
