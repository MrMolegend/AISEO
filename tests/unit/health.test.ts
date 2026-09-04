import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resetEnvCache } from '@/lib/env';
import { GET } from '@/app/api/health/route';

/**
 * The health endpoint.
 *
 * Two jobs, and they are in tension. It must be candid enough that an operator
 * can tell a misconfigured deployment from a working one — in particular that
 * research is being fabricated, which is invisible from the outside — and
 * discreet enough that it names no credential. So the tests check both: what it
 * must say, and what it must never say.
 */

const ORIGINAL = { ...process.env };

interface HealthBody {
  status: string;
  environment: string;
  providers: Record<string, string>;
  problems: string[];
}

function setEnv(vars: Record<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetEnvCache();
}

/** A fully-configured production deployment. */
const PRODUCTION = {
  NODE_ENV: 'production',
  VERCEL_ENV: 'production',
  AUTH_TEST_DRIVER: undefined,
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abc123',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_xyz789',
  UPSTASH_REDIS_REST_URL: 'https://redis.upstash.io',
  UPSTASH_REDIS_REST_TOKEN: 'upstash-token-value',
  AI_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: 'sk-ant-secret-value',
  RESEARCH_PROVIDER: 'tavily',
  TAVILY_API_KEY: 'tvly-secret-value',
} as const;

async function health(vars: Record<string, string | undefined>) {
  setEnv(vars);
  const response = await GET();
  return { response, body: (await response.json()) as HealthBody };
}

beforeEach(() => resetEnvCache());
afterEach(() => {
  setEnv({});
  resetEnvCache();
});

describe('a fully configured production deployment', () => {
  it('is healthy', async () => {
    const { response, body } = await health({ ...PRODUCTION });
    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.problems).toEqual([]);
  });

  it('names the provider serving each subsystem', async () => {
    const { body } = await health({ ...PRODUCTION });
    expect(body.providers).toMatchObject({
      storage: 'supabase',
      auth: 'supabase',
      rateLimit: 'upstash',
      ai: 'anthropic',
      research: 'tavily',
      jobs: 'in-process',
    });
  });
});

describe('places is a deliberate absence, not a missing key', () => {
  it('reports places as disabled', async () => {
    const { body } = await health({ ...PRODUCTION });
    expect(body.providers.places).toBe('disabled');
  });

  it('treats that as a healthy steady state', async () => {
    // There is no GOOGLE_PLACES_API_KEY anywhere in this product. A deployment
    // without one is not degraded; it is the only kind of deployment there is.
    const { response, body } = await health({
      ...PRODUCTION,
      GOOGLE_PLACES_API_KEY: undefined,
    });
    expect(response.status).toBe(200);
    expect(body.problems.join(' ')).not.toMatch(/places/i);
  });

  it('does not change when a places key happens to be present', async () => {
    const { body } = await health({
      ...PRODUCTION,
      GOOGLE_PLACES_API_KEY: 'unused-key',
    });
    expect(body.providers.places).toBe('disabled');
  });
});

describe('LinkedIn reports its mode, and disabled is healthy', () => {
  it('defaults to disabled with no problem raised', async () => {
    const { response, body } = await health({ ...PRODUCTION });
    expect(body.providers.linkedin).toBe('disabled');
    expect(response.status).toBe(200);
    expect(body.problems.join(' ')).not.toMatch(/linkedin/i);
  });

  it('openid_only with credentials is healthy and says so', async () => {
    const { response, body } = await health({
      ...PRODUCTION,
      LINKEDIN_MODE: 'openid_only',
      LINKEDIN_CLIENT_ID: 'client-id',
      LINKEDIN_CLIENT_SECRET: 'client-secret-value',
      LINKEDIN_REDIRECT_URI: 'https://example.com/auth/linkedin/callback',
    });
    expect(body.providers.linkedin).toBe('openid_only');
    expect(response.status).toBe(200);
  });

  it('a mode without its credentials is the one unhealthy LinkedIn shape', async () => {
    const { response, body } = await health({
      ...PRODUCTION,
      LINKEDIN_MODE: 'openid_only',
      LINKEDIN_CLIENT_ID: undefined,
      LINKEDIN_CLIENT_SECRET: undefined,
      LINKEDIN_REDIRECT_URI: undefined,
    });
    expect(response.status).toBe(503);
    expect(body.problems.join(' ')).toMatch(/linkedin/i);
    // Candid about the state, silent about values.
    expect(JSON.stringify(body)).not.toContain('client-secret');
  });
});

describe('production must never silently run on mock research', () => {
  it('is degraded when the research provider is the mock', async () => {
    const { response, body } = await health({
      ...PRODUCTION,
      RESEARCH_PROVIDER: 'mock',
      TAVILY_API_KEY: undefined,
    });
    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.providers.research).toBe('mock');
    expect(body.problems.join(' ')).toMatch(/sources would be fabricated/i);
  });

  it('is degraded when the research key is missing even with the provider set', async () => {
    const { body } = await health({ ...PRODUCTION, TAVILY_API_KEY: undefined });
    expect(body.status).toBe('degraded');
  });

  it('is degraded when synthesis is the mock', async () => {
    const { body } = await health({
      ...PRODUCTION,
      AI_PROVIDER: 'mock',
      ANTHROPIC_API_KEY: undefined,
    });
    expect(body.providers.ai).toBe('mock');
    expect(body.problems.join(' ')).toMatch(/reports would be fabricated/i);
  });

  it('is degraded without Supabase, and without Upstash', async () => {
    const noStore = await health({
      ...PRODUCTION,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
    });
    expect(noStore.body.problems.join(' ')).toMatch(/storage is not Supabase/i);

    const noLimit = await health({
      ...PRODUCTION,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(noLimit.body.problems.join(' ')).toMatch(/rate limiting is in-process/i);
  });
});

describe('a development machine is not held to production rules', () => {
  it('is healthy on fixtures locally', async () => {
    const { response, body } = await health({
      NODE_ENV: 'development',
      VERCEL_ENV: undefined,
      AI_PROVIDER: 'mock',
      RESEARCH_PROVIDER: 'mock',
      ANTHROPIC_API_KEY: undefined,
      TAVILY_API_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.providers.research).toBe('mock');
  });

  it('still names the mock, so nobody has to guess', async () => {
    const { body } = await health({ NODE_ENV: 'development', VERCEL_ENV: undefined });
    expect(body.providers.research).toBe('mock');
    expect(body.providers.ai).toBe('mock');
  });
});

describe('it names providers, never credentials', () => {
  it('leaks no secret value in any state', async () => {
    const secrets = [
      'sb_secret_xyz789',
      'sb_publishable_abc123',
      'sk-ant-secret-value',
      'tvly-secret-value',
      'upstash-token-value',
    ];

    for (const overrides of [
      {},
      { RESEARCH_PROVIDER: 'mock' as const },
      { AI_PROVIDER: 'mock' as const },
      { SUPABASE_SERVICE_ROLE_KEY: undefined },
    ]) {
      const { body } = await health({ ...PRODUCTION, ...overrides });
      const text = JSON.stringify(body);
      for (const secret of secrets) {
        expect(text, `${secret} appeared in the health response`).not.toContain(secret);
      }
    }
  });

  it('returns a fixed shape, so a variable added later cannot leak by accident', async () => {
    const { body } = await health({ ...PRODUCTION, A_NEW_SECRET: 'never-print-me' });
    expect(Object.keys(body).sort()).toEqual([
      'environment',
      'problems',
      'providers',
      'status',
    ]);
    expect(JSON.stringify(body)).not.toContain('never-print-me');
  });

  it('is never cached', async () => {
    const { response } = await health({ ...PRODUCTION });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
