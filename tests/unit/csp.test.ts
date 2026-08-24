import { describe, it, expect } from 'vitest';
import { contentSecurityPolicy, browserOriginOf } from '@/lib/security/csp';

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

  it('refuses a value that is not an http(s) URL', () => {
    for (const bad of [
      'not-a-url',
      'euyhkmtxdigdnvmboebf.supabase.co',
      'javascript:alert(1)',
      'data:text/html,<script>',
      'file:///etc/passwd',
      '',
      '   ',
    ]) {
      expect(browserOriginOf(bad)).toBeNull();
      expect(
        connectSources(contentSecurityPolicy({ isDev: false, supabaseUrl: bad })),
      ).toEqual(["'self'"]);
    }
  });
});

describe('connect-src with Supabase absent', () => {
  it('emits no Supabase allowance at all', () => {
    for (const missing of [undefined, null, '']) {
      const policy = contentSecurityPolicy({ isDev: false, supabaseUrl: missing });

      expect(connectSources(policy)).toEqual(["'self'"]);
      expect(policy).not.toContain('supabase');
    }
  });

  it('is byte-identical to the policy this change started from', () => {
    // A deployment with no Supabase configured must be completely unaffected.
    expect(contentSecurityPolicy({ isDev: false, supabaseUrl: undefined })).toBe(
      [
        `default-src 'self'`,
        `script-src 'self' 'unsafe-inline'`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: https:`,
        `font-src 'self' data:`,
        `connect-src 'self'`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
        `upgrade-insecure-requests`,
      ].join('; '),
    );
  });
});

describe('development', () => {
  it('keeps the HMR socket and the localhost allowance', () => {
    const sources = connectSources(
      contentSecurityPolicy({ isDev: true, supabaseUrl: undefined }),
    );

    expect(sources).toContain('ws:');
    expect(sources).toContain('http://localhost:*');
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
