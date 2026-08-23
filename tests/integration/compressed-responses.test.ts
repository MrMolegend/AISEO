import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { gzipSync, deflateSync, deflateRawSync, brotliCompressSync } from 'node:zlib';
import { safeFetch, FETCH_LIMITS } from '@/lib/security/safe-fetch';
import { isPlatformError, type ErrorCode } from '@/lib/errors';
import { parseHtml } from '@/lib/extraction/parse-html';
import { extractMeta } from '@/lib/extraction/extractors/meta';
import { extractHeadings, extractContent } from '@/lib/extraction/extractors/structure';

/**
 * Regression tests for the production decoding bug.
 *
 * The fetcher advertised `Accept-Encoding: gzip, deflate` and then decoded the
 * raw stream as UTF-8. Audit DdYlwvr0XsvK stored a gzip stream — beginning with
 * the 1F 8B magic number — as though it were the page's visible text, and an
 * ordinary page was analysed as having no readable content.
 *
 * These run against a real HTTP server producing real compressed bytes. A
 * mocked body would have been decoded correctly by construction and would have
 * proved nothing: the failure was in the byte handling itself.
 */

let server: Server;
let port: number;
const origin = () => `http://127.0.0.1:${port}`;

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Example Domain</title>
  <meta name="description" content="Illustrative example page.">
  <link rel="canonical" href="https://example.com/">
</head>
<body>
  <h1>Example Domain</h1>
  <h2>More information</h2>
  <p>This domain is for use in illustrative examples in documents.</p>
</body>
</html>`;

/** The gzip magic number. Its appearance in decoded text is the bug's signature. */
const GZIP_MAGIC = String.fromCharCode(0x1f, 0x8b);

/** Compresses beautifully, expands enormously — the classic bomb shape. */
const BOMB_PLAIN = Buffer.alloc(64 * 1024 * 1024, 0x41);

function send(res: ServerResponse, body: Buffer, encoding?: string) {
  const headers: Record<string, string> = { 'content-type': 'text/html; charset=utf-8' };
  if (encoding) headers['content-encoding'] = encoding;
  res.writeHead(200, headers);
  res.end(body);
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
    const plain = Buffer.from(PAGE, 'utf8');

    switch (path) {
      case '/identity':
        return send(res, plain);
      case '/gzip':
        return send(res, gzipSync(plain), 'gzip');
      case '/deflate':
        return send(res, deflateSync(plain), 'deflate');
      case '/deflate-raw':
        // Technically wrong per RFC 1950, and entirely real in the wild.
        return send(res, deflateRawSync(plain), 'deflate');
      case '/brotli':
        return send(res, brotliCompressSync(plain), 'br');
      case '/gzip-uppercase-header':
        return send(res, gzipSync(plain), 'GZIP');
      case '/identity-explicit':
        return send(res, plain, 'identity');

      case '/gzip-malformed': {
        // A valid gzip header followed by rubbish: passes the magic-number
        // check, fails inflation.
        const good = gzipSync(plain);
        const broken = Buffer.concat([
          good.subarray(0, 12),
          Buffer.from('not actually deflate data, at all, whatsoever'),
        ]);
        return send(res, broken, 'gzip');
      }
      case '/gzip-truncated':
        return send(res, gzipSync(plain).subarray(0, 20), 'gzip');
      case '/brotli-malformed':
        return send(res, Buffer.from('this is definitely not brotli'), 'br');

      case '/gzip-bomb':
        return send(res, gzipSync(BOMB_PLAIN), 'gzip');
      case '/brotli-bomb':
        return send(res, brotliCompressSync(BOMB_PLAIN), 'br');

      case '/stacked':
        return send(res, gzipSync(plain), 'gzip, br');
      case '/unknown-encoding':
        return send(res, plain, 'exotic-v9');

      case '/gzip-declared-huge':
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-encoding': 'gzip',
          'content-length': String(FETCH_LIMITS.maxEncodedBytes + 1),
        });
        return res.end(gzipSync(plain));

      default:
        res.writeHead(404).end();
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

async function codeOf(
  promise: Promise<unknown>,
): Promise<ErrorCode | 'NOT_AN_AUDIT_ERROR'> {
  try {
    await promise;
    return 'NOT_AN_AUDIT_ERROR';
  } catch (error) {
    return isPlatformError(error) ? error.code : 'NOT_AN_AUDIT_ERROR';
  }
}

describe('content encodings', () => {
  it.each([
    ['identity', '/identity', 'identity'],
    ['gzip', '/gzip', 'gzip'],
    ['deflate (zlib-wrapped)', '/deflate', 'deflate'],
    ['deflate (raw)', '/deflate-raw', 'deflate'],
    ['brotli', '/brotli', 'br'],
  ])('decodes %s to the original document', async (_label, path, encoding) => {
    const result = await safeFetch(`${origin()}${path}`);

    expect(result.body).toBe(PAGE);
    expect(result.encoding).toBe(encoding);
    expect(result.truncated).toBe(false);
    expect(result.body).not.toContain(GZIP_MAGIC);
  });

  it('treats an explicit identity header and a missing one alike', async () => {
    const explicit = await safeFetch(`${origin()}/identity-explicit`);
    expect(explicit.body).toBe(PAGE);
    expect(explicit.encoding).toBe('identity');
  });

  it('matches the Content-Encoding header case-insensitively', async () => {
    const result = await safeFetch(`${origin()}/gzip-uppercase-header`);
    expect(result.body).toBe(PAGE);
    expect(result.encoding).toBe('gzip');
  });

  it('reports decoded bytes, with encoded bytes tracked separately', async () => {
    const gzip = await safeFetch(`${origin()}/gzip`);

    // Before the fix, `bytes` meant compressed bytes on a compressed response
    // and decoded bytes otherwise: one field with two meanings.
    expect(gzip.bytes).toBe(Buffer.byteLength(PAGE, 'utf8'));
    expect(gzip.encodedBytes).toBeLessThan(gzip.bytes);
    expect(gzip.encodedBytes).toBeGreaterThan(0);

    const identity = await safeFetch(`${origin()}/identity`);
    expect(identity.bytes).toBe(identity.encodedBytes);
  });
});

describe('extraction over a compressed response', () => {
  /**
   * The end-to-end proof. Everything above checks bytes; this checks that the
   * layer which consumes them receives a real document — which is what actually
   * broke. Under the bug every assertion here saw binary noise or nothing.
   */
  it('yields real title, headings, metadata and text from gzip HTML', async () => {
    const result = await safeFetch(`${origin()}/gzip`);
    const parsed = parseHtml(result.body);

    const meta = extractMeta(parsed.raw, result.finalUrl);
    expect(meta.title).toBe('Example Domain');
    expect(meta.description).toBe('Illustrative example page.');
    expect(meta.canonical).toBe('https://example.com/');
    expect(meta.lang).toBe('en');

    const headings = extractHeadings(parsed.visible);
    expect(headings.headings.h1).toEqual(['Example Domain']);
    expect(headings.headings.h2).toEqual(['More information']);

    const content = extractContent(parsed.visible);
    expect(content.text).toContain('illustrative examples in documents');
    expect(content.wordCount).toBeGreaterThan(5);

    // No replacement characters and no stray control bytes in the extracted
    // text. Checked by code point rather than a regex literal, which would
    // put real control characters into this file.
    expect(content.text).not.toContain(String.fromCharCode(0xfffd));
    const controlBytes = [...content.text].filter((ch) => {
      const code = ch.codePointAt(0)!;
      return code < 0x20 && ch !== '\n' && ch !== '\r' && ch !== '\t';
    });
    expect(controlBytes).toEqual([]);
  });
});

describe('malformed compressed bodies', () => {
  it.each([
    ['gzip with a corrupt payload', '/gzip-malformed'],
    ['gzip cut off mid-stream', '/gzip-truncated'],
    ['brotli that is not brotli', '/brotli-malformed'],
  ])('rejects %s with a typed error', async (_label, path) => {
    expect(await codeOf(safeFetch(`${origin()}${path}`))).toBe('RESPONSE_DECODE_FAILED');
  });
});

describe('unsupported encodings', () => {
  it('refuses a stacked Content-Encoding rather than guessing', async () => {
    expect(await codeOf(safeFetch(`${origin()}/stacked`))).toBe('UNSUPPORTED_CONTENT');
  });

  it('refuses an encoding it does not implement', async () => {
    expect(await codeOf(safeFetch(`${origin()}/unknown-encoding`))).toBe(
      'UNSUPPORTED_CONTENT',
    );
  });
});

describe('decompression bombs', () => {
  it.each([
    ['gzip', '/gzip-bomb'],
    ['brotli', '/brotli-bomb'],
  ])('stops a small %s response that expands past the ceiling', async (_label, path) => {
    const result = await safeFetch(`${origin()}${path}`);

    // Clipped at exactly the decoded ceiling, and flagged as clipped.
    expect(result.truncated).toBe(true);
    expect(result.bytes).toBe(FETCH_LIMITS.maxBytes);
    expect(Buffer.byteLength(result.body, 'utf8')).toBe(FETCH_LIMITS.maxBytes);

    // Kilobytes on the wire; 64 MB had we inflated the whole thing.
    expect(result.encodedBytes).toBeLessThan(FETCH_LIMITS.maxEncodedBytes);
  });

  it('rejects a compressed body whose declared length exceeds the encoded ceiling', async () => {
    expect(await codeOf(safeFetch(`${origin()}/gzip-declared-huge`))).toBe(
      'SITE_TOO_LARGE',
    );
  });
});
