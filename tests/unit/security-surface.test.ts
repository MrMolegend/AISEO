import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ERROR_COPY, ERROR_CODES, PlatformError, toPlatformError } from '@/lib/errors';
import { SYSTEM_PROMPT, PROMPT_VERSION } from '@/prompts/market-entry';

/**
 * What must never leave the server.
 *
 * Tavily and Anthropic keys, the Supabase service key, the system prompt, raw
 * provider errors, stack traces and administrative controls. Each of those is a
 * different kind of leak with the same cause — something written for an
 * operator being rendered for a customer — so they are checked together, by
 * reading the tree rather than by asserting on one route.
 */

const ROOT = process.cwd();

const SKIP = new Set([
  'node_modules',
  '.next',
  '.git',
  'screenshots',
  'test-results',
  'playwright-report',
  'coverage',
]);

function walk(dir: string, matcher: RegExp): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full, matcher));
    else if (matcher.test(entry)) found.push(full);
  }
  return found;
}

/** Files that run in the browser: a client component, or anything it imports. */
function clientFiles(): string[] {
  return walk(join(ROOT, 'app'), /\.tsx?$/)
    .concat(walk(join(ROOT, 'components'), /\.tsx?$/))
    .filter((file) => readFileSync(file, 'utf8').startsWith("'use client'"));
}

describe('secrets never reach the browser', () => {
  it('no client component reads a credential', () => {
    const FORBIDDEN =
      /(ANTHROPIC_API_KEY|TAVILY_API_KEY|SUPABASE_SERVICE_ROLE_KEY|ADMIN_GRANT_SECRET|IP_HASH_SALT)/;

    for (const file of clientFiles()) {
      const contents = readFileSync(file, 'utf8');
      expect(contents, `${relative(ROOT, file)} reads a credential`).not.toMatch(
        FORBIDDEN,
      );
    }
  });

  it('every environment variable exposed to the browser is prefixed and public', () => {
    // NEXT_PUBLIC_ is the only thing standing between a variable and a bundle,
    // and the prefix is easy to add to the wrong one.
    const env = readFileSync(join(ROOT, 'lib/env.ts'), 'utf8');
    const publicVars = [...env.matchAll(/^\s{2}(NEXT_PUBLIC_[A-Z_]+):/gm)].map(
      (match) => match[1],
    );

    /*
     * Two names are deliberately exempt. Supabase's browser key is meant to be
     * public and is called a key by Supabase, so the rule cannot be written to
     * exclude it by shape — it is excluded by name, which is the point: adding
     * a third exemption should require thinking about it.
     */
    const PUBLIC_BY_DESIGN = new Set([
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    ]);

    expect(publicVars.length).toBeGreaterThan(0);
    for (const name of publicVars) {
      if (name && PUBLIC_BY_DESIGN.has(name)) continue;
      expect(name, `${name} looks like a secret`).not.toMatch(
        /SECRET|SERVICE_ROLE|PRIVATE|TOKEN$|_KEY$|SALT/,
      );
    }
    for (const name of PUBLIC_BY_DESIGN) {
      expect(publicVars, `${name} is no longer declared`).toContain(name);
    }
  });

  it('the system prompt is server-only and never imported by a client component', () => {
    for (const file of clientFiles()) {
      const contents = readFileSync(file, 'utf8');
      expect(contents, `${relative(ROOT, file)} imports the prompt`).not.toMatch(
        /@\/prompts\//,
      );
    }
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(500);
    expect(PROMPT_VERSION).toMatch(/^market-entry-v\d+$/);
  });
});

describe('errors are safe to show', () => {
  it('every code has copy written for a customer', () => {
    for (const code of ERROR_CODES) {
      const copy = ERROR_COPY[code];
      expect(copy, `${code} has no copy`).toBeTruthy();
      expect(copy.title.length, `${code} has no title`).toBeGreaterThan(0);
      expect(copy.body.length, `${code} has no body`).toBeGreaterThan(0);
    }
  });

  it('no copy names an internal system, a variable or a stack frame', () => {
    for (const code of ERROR_CODES) {
      const text = `${ERROR_COPY[code].title} ${ERROR_COPY[code].body}`;
      expect(text, code).not.toMatch(/anthropic|tavily|supabase|upstash|redis/i);
      expect(text, code).not.toMatch(/[A-Z_]{4,}_(KEY|SECRET|URL|TOKEN)/);
      expect(text, code).not.toMatch(/\bat [A-Za-z]+\.[a-z]+ \(/);
      expect(text, code).not.toMatch(/node_modules|\.ts:\d+/);
    }
  });

  it('turns an unknown provider failure into a generic one, keeping the detail server-side', () => {
    const raw = new Error(
      'connect ECONNREFUSED 10.0.0.5:443 while calling https://api.tavily.com/search?api_key=tvly-secret',
    );
    const platform = toPlatformError(raw);

    const shown = `${ERROR_COPY[platform.code].title} ${ERROR_COPY[platform.code].body}`;
    expect(shown).not.toContain('tvly-secret');
    expect(shown).not.toContain('10.0.0.5');
    expect(shown).not.toContain('ECONNREFUSED');

    // The detail is not discarded — it is kept where an operator can read it.
    expect(platform.message).toContain('ECONNREFUSED');
  });

  it('keeps a PlatformError’s own code rather than reclassifying it', () => {
    const original = new PlatformError('INSUFFICIENT_MARKET_EVIDENCE', 'gate failed');
    expect(toPlatformError(original).code).toBe('INSUFFICIENT_MARKET_EVIDENCE');
  });
});

describe('administrative controls are not part of the product', () => {
  it('no customer-facing page links to the grant route', () => {
    for (const file of walk(join(ROOT, 'app'), /\.tsx$/).concat(
      walk(join(ROOT, 'components'), /\.tsx$/),
    )) {
      const contents = readFileSync(file, 'utf8');
      expect(contents, `${relative(ROOT, file)} links to the admin route`).not.toMatch(
        /\/api\/tokens\/grant|ADMIN_GRANT/,
      );
    }
  });
});

describe('operational cost data stays operational', () => {
  it('is recorded in the job meta and rendered by no dossier component', () => {
    /*
     * The observability record carries what a report cost to produce — how many
     * searches, how many provider credits, how many tokens were reserved. An
     * operator needs all of it; a customer needs none of it, and showing a
     * person the machinery behind a number they paid a flat price for invites
     * exactly the wrong conversation.
     */
    for (const file of walk(join(ROOT, 'components/dossier'), /\.tsx$/).concat(
      walk(join(ROOT, 'app/example'), /\.tsx$/),
    )) {
      const contents = readFileSync(file, 'utf8');
      for (const field of [
        'searchCredits',
        'creditReservedTokens',
        'searchesAdvanced',
        'searchesBasic',
        'qualityGateReasons',
        'settlement',
      ]) {
        expect(contents, `${relative(ROOT, file)} renders ${field}`).not.toContain(field);
      }
    }
  });

  it('exposes no operational field through the public report schema’s coverage panel', async () => {
    // Coverage is what the *research* found, which a reader needs to judge the
    // document. It is deliberately not what the research cost.
    const { EXAMPLE_DOSSIER } = await import('@/fixtures/market-entry/example-dossier');
    const coverage = Object.keys(EXAMPLE_DOSSIER.coverage);

    for (const key of coverage) {
      expect(key, `coverage exposes ${key}`).not.toMatch(
        /credit|token|cost|price|spend|budget/i,
      );
    }
  });
});
