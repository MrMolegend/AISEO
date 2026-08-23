import { defineConfig } from 'vitest/config';

/**
 * Manual suite: tests that need real network access.
 *
 * Kept out of the default config and out of CI so a third-party site being slow
 * or redesigned can never break the build.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/manual/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 60_000,
    // Sequential so the log output reads as a table rather than interleaving.
    fileParallelism: false,
  },
});
