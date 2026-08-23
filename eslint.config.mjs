import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';

/**
 * eslint-config-next v16 ships native flat config, so it is spread directly
 * rather than wrapped in FlatCompat. It already bundles typescript-eslint,
 * eslint-plugin-react, react-hooks, jsx-a11y and import — we layer only our own
 * rules on top.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...nextCoreWebVitals,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // ── Security-critical rules ─────────────────────────────────────────
      //
      // AI- and website-derived text is rendered throughout the report. Banning
      // dangerouslySetInnerHTML at the lint level means an XSS via injected page
      // content is a build failure rather than a code-review catch.
      'react/no-danger': 'error',

      // The Anthropic SDK must stay behind the AIProvider interface so a second
      // provider is a one-file change. Only lib/ai/anthropic-provider.ts may
      // import it directly.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@anthropic-ai/sdk',
              message:
                'Import the AIProvider interface from @/lib/ai instead. Only lib/ai/anthropic-provider.ts may use the SDK directly.',
            },
          ],
        },
      ],

      // ── General strictness ──────────────────────────────────────────────
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // The one file permitted to touch the Anthropic SDK.
  {
    files: ['lib/ai/anthropic-provider.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // The logger is the sanctioned console boundary.
  {
    files: ['lib/observability/logger.ts'],
    rules: { 'no-console': 'off' },
  },

  {
    files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '*.config.{ts,mjs}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
);
