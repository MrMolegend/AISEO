import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { safeFetch, FETCH_LIMITS } from '@/lib/security/safe-fetch';
import { isPlatformError } from '@/lib/errors';

/**
 * safeFetch exercised against a real HTTP server.
 *
 * Unit-testing the address predicate proves the *rule*; this proves the
 * *plumbing* — that the guard is actually wired into the socket path, that
 * redirects are re-validated, and that the byte ceiling really abandons a
 * response rather than reading it all.
 *
 * The server binds to loopback, so these tests need E2E_ALLOW_LOCAL_FETCH. That
 * flag is exactly what production does not set.
 */

let server: Server;
let port: number;
const origin = () => `http://127.0.0.1:${port}`;

function html(body: string): string {
  return `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1`);

    switch (url.pathname) {
      case '/ok':
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html('<h1>Hello</h1>'));
        return;

      case '/slow-headers':
        // Never responds; used to exercise the timeout path.
        return;

      case '/redirect-once':
        res.writeHead(302, { location: `${origin()}/ok` });
        res.end();
        return;

      case '/redirect-relative':
        res.writeHead(302, { location: '/ok' });
        res.end();
        return;

      case '/redirect-loop':
        res.writeHead(302, { location: `${origin()}/redirect-loop` });
        res.end();
        return;

      case '/redirect-to-metadata':
        // The attack: a public URL that bounces to cloud instance metadata.
        res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
        res.end();
        return;

      case '/redirect-to-private':
        res.writeHead(302, { location: 'http://10.0.0.1/' });
        res.end();
        return;

      case '/huge': {
        res.writeHead(200, { 'content-type': 'text/html' });
        // Far past the ceiling, streamed so the cap has to actually cut it off.
        const chunk = 'a'.repeat(64 * 1024);
        for (let i = 0; i < 80; i += 1) res.write(chunk);
        res.end();
        return;
      }

      case '/declared-huge':
        res.writeHead(200, {
          'content-type': 'text/html',
          'content-length': String(FETCH_LIMITS.maxBytes * 4),
        });
        res.end('x');
        return;

      case '/json':
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"not":"html"}');
        return;

      case '/pdf':
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end('%PDF-1.4');
        return;

      case '/403':
        res.writeHead(403, { 'content-type': 'text/html' });
        res.end(html('blocked'));
        return;

      case '/429':
        res.writeHead(429, { 'content-type': 'text/html' });
        res.end(html('slow down'));
        return;

      case '/500':
        res.writeHead(500, { 'content-type': 'text/html' });
        res.end(html('boom'));
        return;

      case '/404':
        res.writeHead(404, { 'content-type': 'text/html' });
        res.end(html('gone'));
        return;

      default:
        res.writeHead(404);
        res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as AddressInfo).port;
  process.env.E2E_ALLOW_LOCAL_FETCH = '1';
});

afterAll(async () => {
  delete process.env.E2E_ALLOW_LOCAL_FETCH;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function expectError(url: string, code: string) {
  try {
    await safeFetch(url);
  } catch (error) {
    expect(isPlatformError(error), `expected PlatformError, got ${String(error)}`).toBe(
      true,
    );
    if (isPlatformError(error)) expect(error.code).toBe(code);
    return;
  }
  throw new Error(`Expected ${url} to fail with ${code}, but it succeeded`);
}

describe('safeFetch — success path', () => {
  it('fetches an HTML page', async () => {
    const result = await safeFetch(`${origin()}/ok`);
    expect(result.status).toBe(200);
    expect(result.body).toContain('<h1>Hello</h1>');
    expect(result.truncated).toBe(false);
    expect(result.redirectChain).toEqual([]);
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('follows an absolute redirect and records the chain', async () => {
    const result = await safeFetch(`${origin()}/redirect-once`);
    expect(result.status).toBe(200);
    expect(result.finalUrl).toBe(`${origin()}/ok`);
    expect(result.redirectChain).toHaveLength(1);
  });

  it('resolves a relative Location header', async () => {
    const result = await safeFetch(`${origin()}/redirect-relative`);
    expect(result.finalUrl).toBe(`${origin()}/ok`);
  });
});

describe('safeFetch — redirects are re-validated', () => {
  /**
   * The single most important test in this file. A public URL that redirects to
   * instance metadata is the canonical SSRF payload, and it is exactly what
   * following redirects automatically would allow.
   */
  it('refuses a redirect to cloud instance metadata', async () => {
    await expectError(`${origin()}/redirect-to-metadata`, 'BLOCKED_URL');
  });

  it('refuses a redirect into RFC1918 space', async () => {
    await expectError(`${origin()}/redirect-to-private`, 'BLOCKED_URL');
  });

  it('gives up on a redirect loop rather than spinning', async () => {
    await expectError(`${origin()}/redirect-loop`, 'SITE_UNREACHABLE');
  });
});

describe('safeFetch — response limits', () => {
  it('abandons a response past the byte ceiling instead of buffering it', async () => {
    const result = await safeFetch(`${origin()}/huge`);
    expect(result.truncated).toBe(true);
    expect(result.body.length).toBeLessThanOrEqual(FETCH_LIMITS.maxBytes);
  });

  it('refuses a response whose declared length exceeds the ceiling', async () => {
    await expectError(`${origin()}/declared-huge`, 'SITE_TOO_LARGE');
  });

  it.each([
    ['/json', 'NOT_HTML'],
    ['/pdf', 'NOT_HTML'],
  ])('rejects non-HTML content at %s', async (path, code) => {
    await expectError(`${origin()}${path}`, code);
  });
});

describe('safeFetch — status mapping', () => {
  it.each([
    ['/403', 'SITE_BLOCKED'],
    ['/429', 'SITE_BLOCKED'],
    ['/404', 'SITE_UNREACHABLE'],
    ['/500', 'SITE_UNREACHABLE'],
  ])('maps %s to %s', async (path, code) => {
    await expectError(`${origin()}${path}`, code);
  });
});

describe('safeFetch — input rejection', () => {
  /*
   * Note on ports: these tests run with E2E_ALLOW_LOCAL_FETCH set, which
   * deliberately relaxes the 80/443 restriction so the fixture server can bind
   * an ephemeral port. Port rejection is therefore asserted in the unit suite
   * (tests/unit/url-validator.test.ts) where the flag is off, rather than here.
   *
   * Nothing in this file may reach real DNS or the public internet.
   */
  it.each([
    ['http://169.254.169.254/', 'BLOCKED_URL'],
    ['http://10.0.0.1/', 'BLOCKED_URL'],
    ['http://192.168.1.1/', 'BLOCKED_URL'],
    ['http://172.16.5.4/', 'BLOCKED_URL'],
    ['http://[::1]/', 'BLOCKED_URL'],
    ['http://[fd00::1]/', 'BLOCKED_URL'],
    ['javascript:alert(1)', 'BLOCKED_URL'],
    ['http://user:pass@10.0.0.1/', 'BLOCKED_URL'],
  ])('refuses %s before opening a socket', async (url, code) => {
    await expectError(url, code);
  });
});
