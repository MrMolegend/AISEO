import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Native replacement for vite-tsconfig-paths; resolves the "@/*" alias.
    tsconfigPaths: true,
    alias: {
      // `server-only` throws when resolved through a client build, which is what
      // Vitest does. Its protection is enforced by Next at build time, so a
      // no-op here costs nothing.
      'server-only': new URL('./tests/stubs/server-only.ts', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
    globals: false,
    setupFiles: ['tests/setup.ts'],
    testTimeout: 15_000,
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'schemas/**', 'prompts/**'],
      exclude: ['**/*.test.ts', 'lib/storage/supabase-server.ts'],
    },
  },
});
