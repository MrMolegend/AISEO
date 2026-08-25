import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  resetEnvCache,
  assertTestAuthDriverIsSafe,
  usingTestAuthDriver,
} from '@/lib/env';

/**
 * Signing out, and the one piece of test-only auth surface.
 *
 * Sign-out used to happen entirely in the browser: clear document.cookie, push
 * a route. That leaves the refresh token valid at Supabase for anyone who
 * copied it, and it leaves the server-rendered header showing whatever it
 * rendered last. These tests assert the replacement does the opposite — the
 * revocation happens server-side and the cleared cookies are on the response.
 */

let signOutCalls = 0;
let signOutThrows = false;

/** Cookies as Supabase clears them: same names, empty, already expired. */
const CLEARED = [
  {
    name: 'sb-euyhkmtxdigdnvmboebf-auth-token.0',
    value: '',
    options: { path: '/', maxAge: 0 },
  },
  {
    name: 'sb-euyhkmtxdigdnvmboebf-auth-token.1',
    value: '',
    options: { path: '/', maxAge: 0 },
  },
];

vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: {
        setAll: (
          cookies: Array<{ name: string; value: string; options: object }>,
          headers: Record<string, string>,
        ) => void;
      };
    },
  ) => ({
    auth: {
      async signOut() {
        signOutCalls += 1;
        if (signOutThrows) throw new Error('upstream unavailable');
        options.cookies.setAll(CLEARED, { 'Cache-Control': 'private, no-store' });
        return { error: null };
      },
    },
  }),
}));

function signOutRequest(cookies: Record<string, string> = {}): NextRequest {
  const request = new NextRequest('https://aiseo-three-omega.vercel.app/auth/sign-out', {
    method: 'POST',
  });
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

async function callSignOut(cookies?: Record<string, string>): Promise<Response> {
  const { POST } = await import('@/app/auth/sign-out/route');
  return POST(signOutRequest(cookies));
}

beforeEach(() => {
  signOutCalls = 0;
  signOutThrows = false;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://aiseo-three-omega.vercel.app';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://euyhkmtxdigdnvmboebf.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_not_a_real_key';
  resetEnvCache();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.AUTH_TEST_DRIVER;
  resetEnvCache();
});

describe('signing out', () => {
  it('revokes the session at Supabase, not just in the browser', async () => {
    await callSignOut({ 'sb-euyhkmtxdigdnvmboebf-auth-token.0': 'value' });
    expect(signOutCalls).toBe(1);
  });

  it('clears the session cookies on the response it returns', async () => {
    const response = await callSignOut({
      'sb-euyhkmtxdigdnvmboebf-auth-token.0': 'value',
    });

    const cleared = response.headers.getSetCookie();
    expect(cleared.length).toBeGreaterThanOrEqual(2);
    // Cleared, not merely re-set: an expiry in the past or Max-Age=0.
    for (const line of cleared) {
      expect(line).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    }
  });

  it('sends the user home with something to read', async () => {
    const response = await callSignOut();

    // 303, or the browser re-POSTs on refresh.
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'https://aiseo-three-omega.vercel.app/?signed-out=1',
    );
  });

  it('still clears cookies when the upstream call fails', async () => {
    // The user asked to leave. Whatever Supabase is doing, they leave.
    signOutThrows = true;

    const response = await callSignOut({
      'sb-euyhkmtxdigdnvmboebf-auth-token.0': 'value',
      'sb-euyhkmtxdigdnvmboebf-auth-token.1': 'value',
    });

    const names = response.headers.getSetCookie().map((l) => l.split('=')[0]);
    expect(names).toContain('sb-euyhkmtxdigdnvmboebf-auth-token.0');
    expect(names).toContain('sb-euyhkmtxdigdnvmboebf-auth-token.1');
    expect(response.headers.get('location')).toContain('/?signed-out=1');
  });

  it('leaves cookies that are not ours alone', async () => {
    const response = await callSignOut({ theme: 'dark', 'sb-x-auth-token': 'v' });

    const names = response.headers.getSetCookie().map((l) => l.split('=')[0]);
    expect(names).not.toContain('theme');
  });

  it('still clears the session when Supabase is not configured', async () => {
    /*
     * This is the bug the end-to-end suite caught and this test did not.
     *
     * The clearing loop used to sit after the "is Supabase configured?" check,
     * so a deployment without credentials — or one running the stand-in auth
     * driver — got the redirect and the confirmation message with the session
     * cookie completely intact. The user was told they had signed out and had
     * not. Asserting only the status code was what let that through.
     */
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    resetEnvCache();

    const response = await callSignOut({
      'sb-euyhkmtxdigdnvmboebf-auth-token.0': 'value',
      'e2e-test-session': 'value',
    });

    expect(response.status).toBe(303);
    expect(signOutCalls).toBe(0);

    const names = response.headers.getSetCookie().map((l) => l.split('=')[0]);
    expect(names).toContain('sb-euyhkmtxdigdnvmboebf-auth-token.0');
    expect(names).toContain('e2e-test-session');
  });

  it('ends a stand-in session as thoroughly as a real one', async () => {
    const response = await callSignOut({ 'e2e-test-session': 'value' });

    const cleared = response.headers
      .getSetCookie()
      .filter((l) => l.startsWith('e2e-test-session='));
    expect(cleared).toHaveLength(1);
    expect(cleared[0]).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });
});

describe('the test auth driver cannot reach production', () => {
  it('is off by default', () => {
    expect(usingTestAuthDriver()).toBe(false);
  });

  it('refuses to stand in front of a real Supabase project', () => {
    // The load-bearing rule. Real credentials mean real accounts, real wallets
    // and real reports behind them, and nothing may stand in for proving who
    // you are. Every other development fallback here degrades and reports
    // itself; a fake session driver is not a degraded service, it is an
    // authentication bypass, so it stops the process instead.
    const env = {
      AUTH_TEST_DRIVER: true,
      NEXT_PUBLIC_SUPABASE_URL: 'https://euyhkmtxdigdnvmboebf.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_real',
    } as Parameters<typeof assertTestAuthDriverIsSafe>[0];

    expect(() => assertTestAuthDriverIsSafe(env)).toThrow(/AUTH_TEST_DRIVER/);
    expect(() => assertTestAuthDriverIsSafe(env)).toThrow(/real project/);
  });

  it('refuses on a production deployment even with no credentials yet', () => {
    const env = {
      AUTH_TEST_DRIVER: true,
      VERCEL_ENV: 'production',
    } as Parameters<typeof assertTestAuthDriverIsSafe>[0];

    expect(() => assertTestAuthDriverIsSafe(env)).toThrow(/production deployment/);
  });

  it('permits it where there is no authentication to bypass', () => {
    // Which is the only configuration the test suites ever run in: no project,
    // so the application already treats every visitor as signed out.
    const env = { AUTH_TEST_DRIVER: true } as Parameters<
      typeof assertTestAuthDriverIsSafe
    >[0];

    expect(() => assertTestAuthDriverIsSafe(env)).not.toThrow();
  });

  it('does not key on NODE_ENV, which next start always sets to production', () => {
    // A guard that has to be switched off to run the end-to-end suite is a
    // guard that gets switched off.
    const env = {
      AUTH_TEST_DRIVER: true,
      NODE_ENV: 'production',
    } as Parameters<typeof assertTestAuthDriverIsSafe>[0];

    expect(() => assertTestAuthDriverIsSafe(env)).not.toThrow();
  });

  it('is not enabled by an unrelated truthy-looking value', () => {
    for (const value of ['0', 'false', 'no', '']) {
      process.env.AUTH_TEST_DRIVER = value;
      resetEnvCache();
      expect(usingTestAuthDriver()).toBe(false);
    }
  });
});
