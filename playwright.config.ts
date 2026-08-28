import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 45_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Lets a sandboxed environment point at a Chromium it already has, rather
    // than downloading one. CI leaves it unset and uses the managed browser.
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
            args: ['--no-sandbox'],
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'desktop',
      testMatch: /journeys\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // The mobile layouts are different screens, not a narrower desktop, so
      // they get their own journeys rather than the desktop ones re-run.
      name: 'mobile',
      testMatch: /mobile\.spec\.ts/,
      // The iPhone 13 profile is the target size (390×844); the engine is
      // pinned to Chromium so the suite needs one browser rather than two.
      use: { ...devices['iPhone 13'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: `npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
