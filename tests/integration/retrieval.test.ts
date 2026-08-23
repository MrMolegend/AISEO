import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { retrieveSiteFacts } from '@/lib/retrieval/fetch-page';
import { siteFactsSchema } from '@/schemas/facts';
import { isPlatformError } from '@/lib/errors';

/**
 * The retrieval layer end to end: URL in, validated SiteFacts out.
 *
 * Served over real HTTP from the fixture corpus, so this covers the composition
 * that unit tests cannot — robots.txt gating, redirect handling, favicon
 * resolution and schema validation all running in sequence.
 */

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), 'fixtures/html', `${name}.html`), 'utf8');

let server: Server;
let port: number;
const origin = () => `http://127.0.0.1:${port}`;

let robotsBody = 'User-agent: *\nDisallow:\nSitemap: http://example.com/sitemap.xml\n';
let robotsStatus = 200;

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://x').pathname;

    if (path === '/robots.txt') {
      res.writeHead(robotsStatus, { 'content-type': 'text/plain' });
      res.end(robotsStatus === 200 ? robotsBody : '');
      return;
    }

    const name = path === '/' ? 'well-optimised' : path.slice(1).replace(/\.html$/, '');
    try {
      const body = fixture(name);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<html><body>not found</body></html>');
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

describe('retrieveSiteFacts — happy path', () => {
  it('produces facts that validate against their own schema', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/`);
    expect(siteFactsSchema.safeParse(facts).success).toBe(true);
  });

  it('captures the measurements the AI will be given', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/`);

    expect(facts.meta.title).toBe(
      'Handmade Ceramic Tableware from Devon — Ashcombe Pottery',
    );
    // The invariant that matters: length is measured on the real value, before
    // any display cap. Hardcoding the number just tests my own arithmetic.
    expect(facts.meta.titleLength).toBe(facts.meta.title!.length);
    expect(facts.headingCounts.h1).toBe(1);
    expect(facts.images.counts.total).toBe(3);
    expect(facts.structuredData.types).toContain('LocalBusiness');
    expect(facts.content.wordCount).toBeGreaterThan(100);
    expect(facts.httpStatus).toBe(200);
    expect(facts.htmlBytes).toBeGreaterThan(0);
  });

  it('resolves the favicon from the declared link tags', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/`);
    expect(facts.faviconUrl).toBe(`${origin()}/icon.svg`);
  });

  it('records robots.txt findings', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/`);
    expect(facts.robotsTxt.found).toBe(true);
    expect(facts.robotsTxt.allowsOurAgent).toBe(true);
    expect(facts.sitemapXml.found).toBe(true);
  });

  it('computes deterministic checks', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/`);
    const byId = new Map(facts.checks.map((c) => [c.id, c]));
    expect(byId.get('title-present')?.status).toBe('pass');
    expect(byId.get('h1-count')?.status).toBe('pass');
    expect(byId.get('structured-data')?.status).toBe('pass');
    // The fixture is served over http, so this must honestly report a failure.
    expect(byId.get('https')?.status).toBe('fail');
  });
});

describe('retrieveSiteFacts — pages we refuse to audit', () => {
  it('refuses a client-rendered shell rather than auditing an empty page', async () => {
    try {
      await retrieveSiteFacts(`${origin()}/spa-shell`);
      throw new Error('expected NO_CONTENT');
    } catch (error) {
      expect(isPlatformError(error)).toBe(true);
      if (isPlatformError(error)) expect(error.code).toBe('NO_CONTENT');
    }
  });

  it('honours a robots.txt that disallows our agent', async () => {
    robotsBody = 'User-agent: *\nDisallow: /\n';
    try {
      await retrieveSiteFacts(`${origin()}/`);
      throw new Error('expected ROBOTS_DISALLOWED');
    } catch (error) {
      expect(isPlatformError(error)).toBe(true);
      if (isPlatformError(error)) expect(error.code).toBe('ROBOTS_DISALLOWED');
    } finally {
      robotsBody = 'User-agent: *\nDisallow:\n';
    }
  });

  it('proceeds when robots.txt is missing entirely', async () => {
    robotsStatus = 404;
    try {
      const facts = await retrieveSiteFacts(`${origin()}/`);
      expect(facts.robotsTxt.found).toBe(false);
      expect(facts.robotsTxt.allowsOurAgent).toBe(true);
    } finally {
      robotsStatus = 200;
    }
  });
});

describe('retrieveSiteFacts — hostile content', () => {
  it('keeps injected instructions out of the extracted text', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/injection-attempt`);

    // Hidden instruction blocks must not survive into what the AI reads.
    expect(facts.content.text).not.toContain('IMPORTANT INSTRUCTION');
    expect(facts.content.text).not.toContain('untrusted_website_data');
    expect(facts.content.text).not.toContain('escalate privileges');
    expect(facts.content.text).not.toContain('I will comply');

    // The genuine page content is still there.
    expect(facts.content.text).toContain('sourdough');
  });

  it('reports a hostile title as observed data rather than dropping it', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/injection-attempt`);
    // Reporting it accurately is correct — it is genuinely what the page says.
    // The defence is that it travels as data, never as instruction.
    expect(facts.meta.title).toContain('Ignore all previous instructions');
  });

  it('survives malformed structured data', async () => {
    const facts = await retrieveSiteFacts(`${origin()}/malformed-schema`);
    expect(facts.structuredData.parseErrors).toBe(1);
    expect(facts.headingCounts.h1).toBe(3);
  });
});
