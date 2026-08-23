/**
 * Global test setup.
 *
 * Every test runs against the mock AI provider and deterministic secrets so that
 * a missing .env never turns into a confusing failure — and so that no test can
 * accidentally spend money on a real Anthropic call.
 *
 * NODE_ENV is read-only under Vitest's typings and is already 'test' here, so it
 * is deliberately not reassigned.
 */
process.env.AI_PROVIDER = 'mock';
process.env.NEXT_PUBLIC_SITE_URL ??= 'http://localhost:3000';
process.env.IP_HASH_SALT ??= 'test-salt-not-a-real-secret';
process.env.LOG_LEVEL ??= 'error';
