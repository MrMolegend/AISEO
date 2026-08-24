import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { resetEnvCache } from '@/lib/env';
import type * as LoggerModule from '@/lib/observability/logger';

/**
 * The bug this file exists for.
 *
 * Supabase's auth logs showed the magic link verified successfully. The browser
 * came back to the site. The application did not have a session, so the user
 * saw a signed-out page — and, having no way to tell that from a failure, asked
 * for another link, and another, until Supabase returned 429.
 *
 * Every layer looked fine in isolation. The build passed, the types passed, the
 * route returned a redirect. What nobody could see was whether the session
 * cookies were actually on that redirect.
 *
 * So these tests assert the real HTTP boundary: they call the route's exported
 * GET with a real NextRequest and read `Set-Cookie` off the Response it
 * returns. `@supabase/ssr` is doubled at the module edge — not the route, not
 * our own functions — so the cookie adapter the route hands to `createServerClient`
 * is the genuine one, exercised the way the library exercises it.
 *
 * Removing the `setAll` body in app/auth/confirm/route.ts must make this fail.
 */

/** Realistic chunked session cookies, as @supabase/ssr writes them. */
const SESSION_COOKIES = [
  {
    name: 'sb-euyhkmtxdigdnvmboebf-auth-token.0',
    value: 'base64-eyJhY2Nlc3NfdG9rZW4iOiJwYXJ0LW9uZSJ9',
    options: { path: '/', maxAge: 3600, sameSite: 'lax' as const, httpOnly: false },
  },
  {
    name: 'sb-euyhkmtxdigdnvmboebf-auth-token.1',
    value: 'cGFydC10d28ifQ',
    options: { path: '/', maxAge: 3600, sameSite: 'lax' as const, httpOnly: false },
  },
];

/** The headers @supabase/ssr 0.12.4 documents as accompanying an auth cookie. */
const ANTI_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
};

interface FakeState {
  /** Set to make verifyOtp fail with a given Supabase code. */
  failWith: string | null;
  /** Records what the route asked Supabase to do. */
  verifyCalls: Array<{ type: string; token_hash: string }>;
  claimsSub: string | null;
}

const state: FakeState = { failWith: null, verifyCalls: [], claimsSub: 'user-uuid-1' };

/*
 * The double sits at the library boundary.
 *
 * `verifyOtp` invokes the caller's own `setAll` exactly as the real library
 * does after a successful verification. That is the whole point: the code under
 * test is the route's cookie adapter and what it writes onto, not a mock of it.
 */
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        getAll: () => Array<{ name: string; value: string }>;
        setAll: (
          cookies: Array<{ name: string; value: string; options: object }>,
          headers: Record<string, string>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      async verifyOtp({ type, token_hash }: { type: string; token_hash: string }) {
        state.verifyCalls.push({ type, token_hash });

        if (state.failWith) {
          const { AuthApiError } = await import('@supabase/supabase-js');
          return {
            data: { user: null, session: null },
            error: new AuthApiError('verification failed', 403, state.failWith),
          };
        }

        options.cookies.setAll(SESSION_COOKIES, ANTI_CACHE_HEADERS);
        return { data: { user: { id: state.claimsSub }, session: {} }, error: null };
      },
      async getClaims() {
        return { data: state.claimsSub ? { claims: { sub: state.claimsSub } } : null };
      },
    },
  }),
}));

const logLines: Array<{ event: string; fields: Record<string, unknown> }> = [];
const captureLogger = {
  info: (event: string, fields: Record<string, unknown>) =>
    logLines.push({ event, fields }),
  warn: (event: string, fields: Record<string, unknown>) =>
    logLines.push({ event, fields }),
  error: (event: string, fields: Record<string, unknown>) =>
    logLines.push({ event, fields }),
  debug: () => {},
};

/*
 * Captured rather than silenced, because two of the tests below are *about*
 * what the logs contain. A single-use credential written to a log line is a
 * used link that outlives its use.
 */
vi.mock('@/lib/observability/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof LoggerModule>();
  return { ...actual, logger: { ...actual.logger, ...captureLogger } };
});

const TOKEN_HASH = 'pkce_f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0';
const ORIGIN = 'https://aiseo-three-omega.vercel.app';

function confirmUrl(params: Record<string, string>): string {
  const url = new URL('/auth/confirm', ORIGIN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function callConfirm(params: Record<string, string>): Promise<Response> {
  const { GET } = await import('@/app/auth/confirm/route');
  return GET(new NextRequest(confirmUrl(params)));
}

/** All Set-Cookie header lines on a response, however many there are. */
function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

function cookieNames(response: Response): string[] {
  return setCookies(response).map((line) => line.split('=')[0] ?? '');
}

beforeEach(() => {
  state.failWith = null;
  state.verifyCalls = [];
  state.claimsSub = 'user-uuid-1';
  logLines.length = 0;

  // Redirects are built from the canonical site URL, not from the request's
  // Host header. See siteOrigin() in lib/auth/server.ts.
  process.env.NEXT_PUBLIC_SITE_URL = ORIGIN;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://euyhkmtxdigdnvmboebf.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_not_a_real_key';
  resetEnvCache();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  resetEnvCache();
});

describe('the session survives the redirect', () => {
  it('puts every session cookie on the response it returns', async () => {
    const response = await callConfirm({ token_hash: TOKEN_HASH, type: 'magiclink' });

    // THE regression. Without these the browser follows the redirect with no
    // session and the user sees a signed-out page after a successful login.
    expect(cookieNames(response)).toEqual([
      'sb-euyhkmtxdigdnvmboebf-auth-token.0',
      'sb-euyhkmtxdigdnvmboebf-auth-token.1',
    ]);

    // Values, not just names — a cleared cookie has the right name too.
    const joined = setCookies(response).join('\n');
    expect(joined).toContain('base64-eyJhY2Nlc3NfdG9rZW4iOiJwYXJ0LW9uZSJ9');
    expect(joined).toContain('cGFydC10d28ifQ');
    expect(joined).toContain('Path=/');
  });

  it('carries the anti-cache headers that came with those cookies', async () => {
    const response = await callConfirm({ token_hash: TOKEN_HASH, type: 'magiclink' });

    // A CDN caching a redirect that carries someone's Set-Cookie hands that
    // session to the next visitor.
    expect(response.headers.get('cache-control')).toBe(
      'private, no-cache, no-store, must-revalidate, max-age=0',
    );
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('expires')).toBe('0');
  });

  it('redirects to the destination rather than back to sign-in', async () => {
    const response = await callConfirm({ token_hash: TOKEN_HASH, type: 'magiclink' });

    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
  });

  it('builds the redirect from the configured site URL, not the request host', async () => {
    /*
     * The bug this replaces: `request.nextUrl.origin` is derived from whatever
     * Host arrived, and Next normalises a loopback address to `localhost`. The
     * end-to-end suite's browser sat on 127.0.0.1 and was handed a redirect to
     * localhost — a different origin, which it simply did not follow. In
     * production the same mismatch means redirecting to a host the session
     * cookie was never set for.
     */
    process.env.NEXT_PUBLIC_SITE_URL = 'https://canonical.example.com';
    resetEnvCache();

    const { GET } = await import('@/app/auth/confirm/route');
    const response = await GET(
      new NextRequest('https://spoofed.example.net/auth/confirm?token_hash=x&type=email'),
    );

    expect(response.headers.get('location')).toBe(
      'https://canonical.example.com/dashboard',
    );
    expect(response.headers.get('location')).not.toContain('spoofed');
  });

  it('asks Supabase to verify the exact token from the link', async () => {
    await callConfirm({ token_hash: TOKEN_HASH, type: 'recovery' });

    expect(state.verifyCalls).toEqual([{ type: 'recovery', token_hash: TOKEN_HASH }]);
  });
});

describe('where each link type lands', () => {
  it.each([
    ['signup', '/auth/set-password'],
    ['invite', '/auth/set-password'],
    ['recovery', '/auth/reset-password'],
    ['magiclink', '/dashboard'],
    ['email', '/dashboard'],
  ])('%s → %s', async (type, expected) => {
    const response = await callConfirm({ token_hash: TOKEN_HASH, type });
    expect(response.headers.get('location')).toBe(`${ORIGIN}${expected}`);
    // Whatever the destination, the session still has to be on the response.
    expect(cookieNames(response)).toHaveLength(2);
  });

  it('honours a safe next parameter', async () => {
    const response = await callConfirm({
      token_hash: TOKEN_HASH,
      type: 'magiclink',
      next: '/research/new/lead-finder',
    });

    expect(response.headers.get('location')).toBe(`${ORIGIN}/research/new/lead-finder`);
  });
});

describe('open redirects are refused', () => {
  it.each([
    ['protocol-relative', '//evil.test/steal'],
    ['backslash', '/\\evil.test/steal'],
    ['absolute', 'https://evil.test/steal'],
    ['scheme', 'javascript:alert(1)'],
    ['auth loop', '/auth/confirm?token_hash=x'],
  ])('falls back to the default destination: %s', async (_name, next) => {
    const response = await callConfirm({
      token_hash: TOKEN_HASH,
      type: 'magiclink',
      next,
    });

    // The user really did sign in to the real site — which is exactly what
    // makes landing them on an attacker's page afterwards worth something.
    expect(response.headers.get('location')).toBe(`${ORIGIN}/dashboard`);
    expect(response.headers.get('location')).not.toContain('evil.test');
  });
});

describe('links that cannot be used', () => {
  it('sends an expired link to the error page, with no session', async () => {
    state.failWith = 'otp_expired';

    const response = await callConfirm({ token_hash: TOKEN_HASH, type: 'magiclink' });

    expect(response.headers.get('location')).toBe(`${ORIGIN}/auth/error?reason=expired`);
    expect(setCookies(response)).toEqual([]);
  });

  it('treats an already-used link the same way', async () => {
    // Supabase reports a consumed token as expired; both mean "get a new one".
    state.failWith = 'otp_expired';
    const response = await callConfirm({ token_hash: TOKEN_HASH, type: 'signup' });
    expect(response.headers.get('location')).toContain('reason=expired');
  });

  it('reports a mangled link as incomplete rather than expired', async () => {
    // Some mail clients truncate long URLs, which loses the token entirely.
    const response = await callConfirm({ type: 'magiclink' });
    expect(response.headers.get('location')).toBe(
      `${ORIGIN}/auth/error?reason=incomplete`,
    );
  });

  it('refuses a type we never issue', async () => {
    const response = await callConfirm({ token_hash: TOKEN_HASH, type: 'sms' });

    expect(response.headers.get('location')).toBe(`${ORIGIN}/auth/error?reason=invalid`);
    expect(state.verifyCalls).toEqual([]);
  });
});

describe('what never reaches the logs', () => {
  it('never writes the token hash anywhere', async () => {
    state.failWith = 'otp_expired';
    await callConfirm({ token_hash: TOKEN_HASH, type: 'magiclink' });
    await callConfirm({ token_hash: TOKEN_HASH, type: 'recovery' });

    state.failWith = null;
    await callConfirm({ token_hash: TOKEN_HASH, type: 'magiclink' });

    // A single-use credential in a log line is a used link that outlives its
    // use — and log lines are copied into tickets and pasted into chats.
    const everything = JSON.stringify(logLines);
    expect(everything).not.toContain(TOKEN_HASH);
    expect(everything).not.toContain('pkce_');
    expect(logLines.length).toBeGreaterThan(0);
  });

  it('never writes a session cookie value', async () => {
    await callConfirm({ token_hash: TOKEN_HASH, type: 'magiclink' });

    const everything = JSON.stringify(logLines);
    expect(everything).not.toContain('eyJhY2Nlc3NfdG9rZW4');
    expect(everything).not.toContain('auth-token');
  });
});
