import 'server-only';
import { getEnv } from '@/lib/env';
import type { AIProvider } from './provider';
import { MockProvider } from './mock-provider';
import { PlatformError } from '@/lib/errors';

export type { AIProvider, AuditModelInput, AuditModelResult } from './provider';
export { MockProvider } from './mock-provider';

let cached: AIProvider | null = null;

/**
 * Resolves the configured provider.
 *
 * Falls back to the mock when AI_PROVIDER is "anthropic" but no key is present,
 * rather than crashing — a developer who has not set up a key should still get a
 * working application, and the log line makes it obvious the audit is fixture
 * data rather than a real analysis.
 */
export async function getProvider(): Promise<AIProvider> {
  if (cached) return cached;

  const env = getEnv();

  if (env.AI_PROVIDER === 'mock') {
    cached = new MockProvider();
    return cached;
  }

  if (!env.ANTHROPIC_API_KEY) {
    throw new PlatformError(
      'AI_UNAVAILABLE',
      'AI_PROVIDER is "anthropic" but ANTHROPIC_API_KEY is not set',
    );
  }

  // Imported lazily so the SDK is never loaded — or required — in mock mode.
  const { AnthropicProvider } = await import('./anthropic-provider');
  cached = new AnthropicProvider(env.ANTHROPIC_API_KEY, env.AI_MODEL);
  return cached;
}

/** Test-only: clears the memoised provider so env changes take effect. */
export function resetProviderCache(): void {
  cached = null;
}
