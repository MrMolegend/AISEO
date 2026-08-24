import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * End-to-end configuration.
 *
 * The suite runs against the mock AI provider and the in-memory storage driver:
 * no API key, no external accounts, no network egress and no cost. That is what
 * makes it safe to run on every CI push.
 *
 * Scope is the signed-out surface. Signing in needs a real Supabase project,
 * and standing one up per CI run would trade a fast, free, deterministic suite
 * for a slow, credentialed, flaky one. The signed-in paths — the wallet, the
 * job lifecycle, refunds, access control — are covered in tests/integration
 * against the same server code, without a browser.
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    /*
     * Readiness is probed on the landing page, not /api/health. The health
     * endpoint deliberately returns 503 when the app is running on development
     * drivers — which is exactly the configuration this suite uses — so it would
     * never report ready. Serving the landing page is the honest signal that the
     * server is up.
     */
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      AI_PROVIDER: 'mock',
      NEXT_PUBLIC_SITE_URL: baseURL,
      IP_HASH_SALT: 'e2e-salt-not-a-real-secret',
      // Lets the suite reach its own loopback origin.
      E2E_ALLOW_LOCAL_FETCH: '1',
      // Generous, so rate limiting never makes the suite flaky. Limit behaviour
      // is asserted directly in tests/unit and tests/integration.
      RESEARCH_RATE_LIMIT_PER_HOUR: '500',
      RESEARCH_RATE_LIMIT_PER_DAY: '2000',
      RESEARCH_DAILY_GLOBAL_CAP: '5000',
      RESEARCH_CACHE_TTL_HOURS: '1',
      LOG_LEVEL: 'warn',
    },
  },
});
