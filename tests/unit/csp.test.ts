import { describe, it, expect } from 'vitest';
import {
  contentSecurityPolicy,
  browserOriginOf,
  supabaseConnectOrigin,
  DEFAULT_SUPABASE_ORIGIN,
} from '@/lib/security/csp';

/**
 * The header that broke production sign-in.
 *
 *   Connecting to https://<project>.supabase.co/auth/v1/otp violates the
 *   Content Security Policy directive: connect-src 'self'
 *
 * The browser refused the request before it left the page, so the sign-in form
 * could only show its generic failure — the one message that tells a user
 * nothing and a developer less. Nobody could sign in.
 *
 * A CSP is a security control whose failures are invisible until they are
 * total, in one direction or the other: too tight and a feature silently stops
 * working, too loose and an injected script gets a free exfiltration channel.
 * Neither shows up in a typecheck. So this file asserts the whole header —
 * what must be there, and just as carefully what must not.
 */

const PROJECT = 'https://euyhkmtxdigdnvmboebf.supabase.co';

/** The literal production requirement, written out rather than derived. */
const REQUIRED_CONNECT_SRC = `connect-src 'self' https://euyhkmtxdigdnvmboebf.supabase.co`;

/** Parses "a 'self' b; c 'none'" into { 'connect-src': ["'self'", …] }. */
function directives(policy: string): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};
  for (const directive of policy.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name) parsed[name] = sources;
  }
  return parsed;
}

function connectSources(policy: string): string[] {
  return directives(policy)['connect-src'] ?? [];
}

describe('connect-src with Supabase configured', () => {
  const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: PROJECT });

  it('allows the configured Supabase origin', () => {
    // The regression itself: without this, /auth/v1/otp never leaves the page.
    expect(connectSources(policy)).toContain(PROJECT);
  });

  it('keeps the origin exact, with no wildcard standing in for it', () => {
    const sources = connectSources(policy);

    expect(sources).toEqual(["'self'", PROJECT]);
    // A wildcard would hand injected script an exfiltration channel to every
    // host under it, which is the whole reason connect-src exists.
    for (const forbidden of [
      'https:',
      'http:',
      '*',
      '*.supabase.co',
      'https://*.supabase.co',
      '*.co',
    ]) {
      expect(sources).not.toContain(forbidden);
    }
  });

  it('adds nothing for services that are only ever called server-side', () => {
    // Anthropic, Tavily and Upstash are reached from route handlers and the
    // job runner. CSP does not apply there, so a browser allowance would widen
    // the page's reach for nothing.
    for (const host of ['anthropic.com', 'tavily.com', 'upstash.io']) {
      expect(policy).not.toContain(host);
    }
  });
});

describe('what must never reach the header', () => {
  it('strips a path, query and fragment', () => {
    const policy = contentSecurityPolicy({
      isDev: false,
      supabaseUrl: `${PROJECT}/auth/v1?apikey=sb-secret#fragment`,
    });

    expect(connectSources(policy)).toEqual(["'self'", PROJECT]);
    expect(policy).not.toContain('/auth/v1');
    expect(policy).not.toContain('apikey');
    expect(policy).not.toContain('sb-secret');
    expect(policy).not.toContain('#');
  });

  it('strips embedded credentials', () => {
    // A response header is world-readable. A key that reached it would be
    // published to every visitor, and to every log and proxy in between.
    const policy = contentSecurityPolicy({
      isDev: false,
      supabaseUrl: 'https://postgres:service-role-key@euyhkmtxdigdnvmboebf.supabase.co',
    });

    expect(connectSources(policy)).toEqual(["'self'", PROJECT]);
    expect(policy).not.toContain('service-role-key');
    expect(policy).not.toContain('postgres');
    expect(policy).not.toContain('@');
  });

  it('never contains anything shaped like a key, whatever it is handed', () => {
    for (const hostile of [
      `${PROJECT}?apikey=eyJhbGciOiJIUzI1NiJ9.payload.signature`,
      'https://anon:eyJhbGciOiJIUzI1NiJ9@project.supabase.co',
      `${PROJECT}/rest/v1/token_ledger?select=*`,
    ]) {
      const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: hostile });
      expect(policy).not.toMatch(/eyJ[A-Za-z0-9_-]/);
      expect(policy).not.toContain('token_ledger');
      expect(policy).not.toContain('?');
    }
  });

  it('refuses a value that is not an http(s) URL, and falls back rather than dropping the origin', () => {
    for (const bad of [
      'not-a-url',
      'euyhkmtxdigdnvmboebf.supabase.co',
      'javascript:alert(1)',
      'data:text/html,<script>',
      'file:///etc/passwd',
      'postgres://user:pw@db.supabase.co:5432/postgres',
      '',
      '   ',
    ]) {
      expect(browserOriginOf(bad)).toBeNull();
      // A variable that is set but wrong must not be able to take the origin
      // away — that would reproduce the original outage through a typo.
      expect(
        connectSources(contentSecurityPolicy({ isDev: false, supabaseUrl: bad })),
      ).toEqual(["'self'", PROJECT]);
    }
  });
});

describe('connect-src when the build environment supplies nothing', () => {
  /*
   * The reason this fallback exists.
   *
   * The previous fix derived the origin from NEXT_PUBLIC_SUPABASE_URL alone.
   * `headers()` runs during the build, that variable was not in Vercel's build
   * environment, and the deployed policy went out as bare `connect-src 'self'`.
   * Nothing failed: not the build, not CI, not a typecheck. Only every sign-in,
   * in the browser, with a generic error message.
   *
   * So the environment is an override and the origin is a constant, and these
   * assert the constant — the case a passing build cannot tell you about.
   */

  it('still allows the Supabase origin', () => {
    for (const missing of [undefined, null, '']) {
      const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: missing });
      expect(connectSources(policy)).toEqual(["'self'", PROJECT]);
    }
  });

  it('produces exactly the directive production must serve', () => {
    // Written out in full, deliberately. A derived expectation would pass
    // against a derived bug.
    expect(contentSecurityPolicy({ isDev: false, supabaseUrl: undefined })).toContain(
      REQUIRED_CONNECT_SRC,
    );
    expect(DEFAULT_SUPABASE_ORIGIN).toBe('https://euyhkmtxdigdnvmboebf.supabase.co');
  });

  it('is the whole production policy, byte for byte', () => {
    expect(contentSecurityPolicy({ isDev: false, supabaseUrl: undefined })).toBe(
      [
        `default-src 'self'`,
        `script-src 'self' 'unsafe-inline'`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: https:`,
        `font-src 'self' data:`,
        REQUIRED_CONNECT_SRC,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
        `upgrade-insecure-requests`,
      ].join('; '),
    );
  });

  it('carries no key of any kind alongside the origin', () => {
    // The origin is public. A publishable or service-role key is not, and a
    // response header is readable by every visitor and every proxy in between.
    const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: undefined });

    expect(policy).not.toMatch(/eyJ[A-Za-z0-9_-]/); // JWT
    expect(policy).not.toMatch(/sb_(publishable|secret)_/); // new-style keys
    expect(policy).not.toMatch(/service[_-]?role/i);
    expect(policy).not.toContain('anon');
    expect(policy).not.toContain('apikey');
  });
});

describe('a malformed environment variable cannot reach the header', () => {
  /*
   * NEXT_PUBLIC_SUPABASE_URL is set by whoever configures the deployment, and
   * its value is copied verbatim into a response header. That makes it an
   * injection surface: a newline splits the response, and a space or semicolon
   * adds or terminates directives — a smuggled `script-src *` would disable
   * the very policy it was injected into.
   *
   * Two things stop it. URL parsing rejects or normalises everything that is
   * not scheme, host and port, and a pattern check asserts that afterwards, so
   * the guarantee does not depend on the parser continuing to behave the way
   * it does today.
   */

  const CR = String.fromCharCode(13);
  const LF = String.fromCharCode(10);
  const NUL = String.fromCharCode(0);
  const LINE_SEPARATOR = String.fromCharCode(0x2028);

  /** Values the URL parser cannot make an origin out of at all. */
  const REJECTED = [
    ['CRLF header injection', `https://evil.test${CR}${LF}X-Injected: yes`],
    ['LF cookie injection', `https://evil.test${LF}Set-Cookie: session=stolen`],
    [
      'response splitting',
      `https://evil.test${CR}${LF}${CR}${LF}<script>alert(1)</script>`,
    ],
    ['smuggled directive', 'https://evil.test; script-src *'],
    ['smuggled keyword', `https://evil.test 'unsafe-inline'`],
    [
      'smuggled report-uri',
      'https://evil.test; default-src *; report-uri https://e.test/c',
    ],
    ['smuggled wildcard', 'https://evil.test *'],
    ['trailing semicolon', 'https://evil.test;'],
    ['JSON', '{"origin":"https://evil.test"}'],
    ['path traversal', '../../etc/passwd'],
    ['HTML', '<img src=x onerror=alert(1)>'],
  ] as const;

  /**
   * Values the parser *normalises* rather than rejects.
   *
   * Both of these characters are stripped during URL parsing, leaving an
   * ordinary origin. Worth asserting explicitly rather than assuming: the
   * question is not whether the host survives — someone who can set this
   * variable can set it to any host they like, which is configuration, not
   * injection — but whether anything travels with it into the header.
   */
  const NORMALISED = [
    ['trailing NUL', `https://evil.test${NUL}`, 'https://evil.test'],
    ['trailing U+2028', `https://evil.test${LINE_SEPARATOR}`, 'https://evil.test'],
  ] as const;

  const ALL = [...REJECTED.map(([, v]) => v), ...NORMALISED.map(([, v]) => v)];

  it.each(REJECTED)('falls back to the project origin: %s', (_name, hostile) => {
    const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: hostile });

    expect(browserOriginOf(hostile)).toBeNull();
    // Exactly the header a correct deployment serves, as if nothing was set.
    expect(policy).toContain(REQUIRED_CONNECT_SRC);
    expect(connectSources(policy)).toEqual(["'self'", PROJECT]);

    // And not a character of the attempt survives anywhere.
    expect(policy).not.toContain('evil.test');
    expect(policy).not.toContain('X-Injected');
    expect(policy).not.toContain('Set-Cookie');
    expect(policy).not.toContain('script>');
    expect(policy).not.toContain('report-uri');
    expect(policy).not.toContain('alert');
    expect(policy).not.toContain('passwd');
  });

  it.each(NORMALISED)('carries nothing but the origin: %s', (_name, hostile, origin) => {
    // The stripped character does not reach the header, and nothing is
    // appended to the source expression it produced.
    expect(browserOriginOf(hostile)).toBe(origin);
    expect(
      connectSources(contentSecurityPolicy({ isDev: false, supabaseUrl: hostile })),
    ).toEqual(["'self'", origin]);
  });

  it('never emits a character that could add, end or split a directive', () => {
    // The invariant that actually matters, asserted over every input above —
    // rejected, normalised, valid and absent alike.
    for (const value of [...ALL, PROJECT, undefined, null, '']) {
      const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: value });

      // Checked by code point rather than a regex: a character class of
      // literal control characters is itself a lint error, and this reads
      // more plainly than the escapes would.
      for (const character of policy) {
        const code = character.codePointAt(0) ?? 0;
        expect(code).toBeGreaterThan(0x1f);
        expect(code).not.toBe(0x7f);
        expect(code).not.toBe(0x2028);
        expect(code).not.toBe(0x2029);
      }
      // Eleven directives, no more: a smuggled twelfth would raise this.
      expect(policy.split(';')).toHaveLength(11);
      // No source expression contains whitespace, which is what separates one
      // source from the next.
      for (const source of connectSources(policy)) {
        expect(source).not.toMatch(/\s/);
      }
    }
  });

  it('honours a well-formed override, reduced to its origin', () => {
    // The variable is still an override when it is usable — it simply cannot
    // be smuggled in through a malformed one, and it still loses its path.
    const policy = contentSecurityPolicy({
      isDev: false,
      supabaseUrl: 'https://another-project.supabase.co/rest/v1?apikey=abc',
    });

    expect(connectSources(policy)).toEqual([
      "'self'",
      'https://another-project.supabase.co',
    ]);
    expect(policy).not.toContain('apikey');
  });

  it('resolves any unusable value to the project origin', () => {
    for (const bad of [undefined, null, '', '  ', 'nonsense', 'ftp://x.test']) {
      expect(supabaseConnectOrigin(bad)).toBe(PROJECT);
    }
  });
});

describe('development', () => {
  it('keeps the HMR socket and the localhost allowance', () => {
    const sources = connectSources(
      contentSecurityPolicy({ isDev: true, supabaseUrl: undefined }),
    );

    expect(sources).toContain('ws:');
    expect(sources).toContain('http://localhost:*');
    // And the fallback origin, so `next dev` without a .env.local can sign in.
    expect(sources).toEqual(["'self'", PROJECT, 'ws:', 'http://localhost:*']);
  });

  it('keeps them alongside Supabase rather than instead of it', () => {
    // The two allowances are independent, and an earlier shape of this
    // directive made them exclusive by building it with a ternary.
    const sources = connectSources(
      contentSecurityPolicy({ isDev: true, supabaseUrl: PROJECT }),
    );

    expect(sources).toEqual(["'self'", PROJECT, 'ws:', 'http://localhost:*']);
  });

  it('allows unsafe-eval for React Refresh, and only in development', () => {
    const dev = directives(contentSecurityPolicy({ isDev: true, supabaseUrl: PROJECT }));
    const prod = directives(
      contentSecurityPolicy({ isDev: false, supabaseUrl: PROJECT }),
    );

    expect(dev['script-src']).toContain(`'unsafe-eval'`);
    expect(prod['script-src']).not.toContain(`'unsafe-eval'`);
  });
});

describe('the directives this change must not disturb', () => {
  const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: PROJECT });
  const parsed = directives(policy);

  it.each([
    ['default-src', [`'self'`]],
    ['script-src', [`'self'`, `'unsafe-inline'`]],
    ['style-src', [`'self'`, `'unsafe-inline'`]],
    ['img-src', [`'self'`, 'data:', 'https:']],
    ['font-src', [`'self'`, 'data:']],
    ['object-src', [`'none'`]],
    ['base-uri', [`'self'`]],
    ['form-action', [`'self'`]],
    ['frame-ancestors', [`'none'`]],
    ['upgrade-insecure-requests', []],
  ])('%s is unchanged', (name, sources) => {
    expect(parsed[name]).toEqual(sources);
  });

  it('still names every directive, in the same order', () => {
    expect(Object.keys(parsed)).toEqual([
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
      'upgrade-insecure-requests',
    ]);
  });

  it('produces a header a browser will parse', () => {
    // One directive per `;`, no stray separators, no empty segments — a
    // malformed CSP is silently dropped by some browsers and enforced by
    // others, which is the worst of both.
    expect(policy).not.toMatch(/;\s*;/);
    expect(policy).not.toMatch(/;\s*$/);
    expect(policy).not.toMatch(/\s{2,}/);
    expect(policy).not.toContain('\n');
    expect(policy).not.toContain('undefined');
    expect(policy).not.toContain('null');
  });
});
