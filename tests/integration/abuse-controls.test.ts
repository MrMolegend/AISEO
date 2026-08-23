import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAudit } from '@/lib/pipeline/create-audit';
import { resetRateLimiter } from '@/lib/security/rate-limit';
import { resetStores } from '@/lib/storage';
import { resetEnvCache } from '@/lib/env';
import { isPlatformError } from '@/lib/errors';

/**
 * The controls that stand between a public endpoint and an unbounded bill.
 *
 * These are asserted rather than assumed because the failure mode is financial
 * and silent: nothing breaks, the audits just keep running and the invoice
 * arrives at the end of the month.
 */

const headersFor = (ip: string) => new Headers({ 'x-forwarded-for': ip });

function setLimits(overrides: Record<string, string>) {
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
  resetEnvCache();
  resetRateLimiter();
  resetStores();
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  // Deliberately NOT setting E2E_ALLOW_LOCAL_FETCH: createAudit never opens a
  // socket, and the flag would relax the port rule these tests assert.
  delete process.env.E2E_ALLOW_LOCAL_FETCH;
  setLimits({
    RESEARCH_RATE_LIMIT_PER_HOUR: '3',
    RESEARCH_RATE_LIMIT_PER_DAY: '10',
    RESEARCH_DAILY_GLOBAL_CAP: '200',
    RESEARCH_CACHE_TTL_HOURS: '24',
    IP_HASH_SALT: 'test-salt-value',
  });
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  resetEnvCache();
  resetRateLimiter();
  resetStores();
});

async function expectRejection(fn: () => Promise<unknown>, code: string) {
  try {
    await fn();
  } catch (error) {
    expect(isPlatformError(error)).toBe(true);
    if (isPlatformError(error)) expect(error.code).toBe(code);
    return;
  }
  throw new Error(`Expected rejection with ${code}`);
}

describe('per-client rate limiting', () => {
  it('allows up to the hourly limit and refuses the next request', async () => {
    const headers = headersFor('203.0.113.10');

    for (let i = 0; i < 3; i += 1) {
      const result = await createAudit(`https://site-${i}.example/`, headers);
      expect(result.cached).toBe(false);
    }

    await expectRejection(
      () => createAudit('https://site-overflow.example/', headers),
      'RATE_LIMITED',
    );
  });

  it('limits each client independently', async () => {
    const first = headersFor('203.0.113.20');
    const second = headersFor('203.0.113.21');

    for (let i = 0; i < 3; i += 1) {
      await createAudit(`https://a-${i}.example/`, first);
    }
    await expectRejection(
      () => createAudit('https://a-x.example/', first),
      'RATE_LIMITED',
    );

    // The second client is unaffected.
    const result = await createAudit('https://b-0.example/', second);
    expect(result.cached).toBe(false);
  });

  it('reports how long to wait, so the UI can count down', async () => {
    const headers = headersFor('203.0.113.30');
    for (let i = 0; i < 3; i += 1) {
      await createAudit(`https://c-${i}.example/`, headers);
    }

    try {
      await createAudit('https://c-x.example/', headers);
      throw new Error('expected rejection');
    } catch (error) {
      if (isPlatformError(error)) {
        expect(typeof error.context.retryAfterSeconds).toBe('number');
        expect(error.context.retryAfterSeconds as number).toBeGreaterThan(0);
      }
    }
  });
});

describe('global circuit breaker', () => {
  it('refuses everything once the daily cap is reached', async () => {
    // The backstop that turns a runaway into an error message rather than a bill.
    setLimits({
      RESEARCH_DAILY_GLOBAL_CAP: '2',
      RESEARCH_RATE_LIMIT_PER_HOUR: '100',
      RESEARCH_RATE_LIMIT_PER_DAY: '100',
    });

    await createAudit('https://g-1.example/', headersFor('198.51.100.1'));
    await createAudit('https://g-2.example/', headersFor('198.51.100.2'));

    // A different client is refused too: the cap is global, not per-client.
    await expectRejection(
      () => createAudit('https://g-3.example/', headersFor('198.51.100.3')),
      'CAPACITY',
    );
  });
});

describe('duplicate handling', () => {
  it('locks a URL that is already being audited', async () => {
    const first = await createAudit(
      'https://locked.example/',
      headersFor('203.0.113.40'),
    );
    expect(first.cached).toBe(false);

    // The audit is still queued, so there is no cached result to return — the
    // lock is what stops a double-click paying for two identical analyses.
    await expectRejection(
      () => createAudit('https://locked.example/', headersFor('203.0.113.41')),
      'RATE_LIMITED',
    );
  });

  it('normalises before hashing, so tracking parameters do not split the lock', async () => {
    await createAudit('https://dedupe.example/', headersFor('203.0.113.50'));

    // Same page, different campaign tags: must be recognised as the same URL.
    await expectRejection(
      () =>
        createAudit(
          'https://dedupe.example/?utm_source=x&utm_campaign=y',
          headersFor('203.0.113.51'),
        ),
      'RATE_LIMITED',
    );
  });
});

describe('intake rejection', () => {
  it.each([
    ['not a url', 'INVALID_URL'],
    ['javascript:alert(1)', 'INVALID_URL'],
    ['http://example.com:6379/', 'INVALID_URL'],
  ] as const)('rejects %s as %s before spending anything', async (url, code) => {
    await expectRejection(() => createAudit(url, headersFor('203.0.113.60')), code);
  });

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/',
    'http://192.168.1.1/',
    'http://172.16.4.4/',
  ])('refuses the non-public IPv4 literal %s at intake', async (url) => {
    // Accepting these would consume a rate-limit slot and create a row for an
    // address the fetch layer is certain to refuse.
    await expectRejection(
      () => createAudit(url, headersFor('203.0.113.61')),
      'BLOCKED_URL',
    );
  });

  it.each(['http://[::1]/', 'http://[fd00::1]/', 'http://[fe80::1]/'])(
    'refuses the IPv6 literal %s at the syntactic layer',
    async (url) => {
      /*
       * Bracketed IPv6 hosts contain no dot, so the public-shape check refuses
       * them before the address check is reached — hence INVALID_URL rather than
       * BLOCKED_URL. Both are refusals; which layer catches it is an
       * implementation detail, and the earlier the better.
       */
      await expectRejection(
        () => createAudit(url, headersFor('203.0.113.62')),
        'INVALID_URL',
      );
    },
  );

  it('does not consume a rate-limit slot for a rejected URL', async () => {
    const headers = headersFor('203.0.113.70');

    for (let i = 0; i < 5; i += 1) {
      await expectRejection(() => createAudit('nonsense', headers), 'INVALID_URL');
    }

    // The three legitimate attempts must still be available.
    for (let i = 0; i < 3; i += 1) {
      const result = await createAudit(`https://after-${i}.example/`, headers);
      expect(result.cached).toBe(false);
    }
  });
});
