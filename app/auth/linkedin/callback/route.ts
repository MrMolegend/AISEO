import { cookies } from 'next/headers';
import { requireMember, recordAudit } from '@/lib/auth/membership';
import { validateCallback } from '@/lib/linkedin/oauth';
import { exchangeCodeForIdentity } from '@/lib/linkedin/provider';
import { getConnectionStore } from '@/lib/linkedin/connections';
import { logger } from '@/lib/observability/logger';

/**
 * Completes the LinkedIn identity link.
 *
 * The state must match the HttpOnly cookie exactly and the exchange runs
 * entirely server-side; every failure collapses into one generic redirect
 * that says the link did not complete, without echoing why — OAuth error
 * details are for the log, not the address bar.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OAUTH_COOKIE = 'li-oauth';

function done(outcome: 'linked' | 'failed'): Response {
  const response = new Response(null, {
    status: 302,
    headers: { location: `/account?linkedin=${outcome}` },
  });
  response.headers.append(
    'set-cookie',
    `${OAUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return response;
}

export async function GET(request: Request) {
  let userId: string;
  try {
    const membership = await requireMember();
    userId = membership.user.id;
  } catch {
    return new Response(null, { status: 302, headers: { location: '/sign-in' } });
  }

  try {
    const url = new URL(request.url);
    const store = await cookies();
    const raw = store.get(OAUTH_COOKIE)?.value;
    const parsed = raw
      ? (JSON.parse(decodeURIComponent(raw)) as { state?: string; verifier?: string })
      : null;

    const validated = validateCallback({
      expectedState: parsed?.state ?? null,
      receivedState: url.searchParams.get('state'),
      code: url.searchParams.get('code'),
    });
    if (!validated || !parsed?.verifier) {
      logger.warn('linkedin.callback_rejected', { userId });
      return done('failed');
    }

    const identity = await exchangeCodeForIdentity({
      code: validated.code,
      codeVerifier: parsed.verifier,
    });

    const connections = await getConnectionStore();
    await connections.upsertLinkedIn(userId, identity);
    await recordAudit(userId, 'linkedin.linked', 'provider_connection', userId, {
      grantedScopes: identity.grantedScopes,
    });
    return done('linked');
  } catch (error) {
    logger.warn('linkedin.link_failed', {
      userId,
      error: error instanceof Error ? error.message : 'unknown',
    });
    return done('failed');
  }
}
