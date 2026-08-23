import { describe, expect, it } from 'vitest';
import { redact } from '@/lib/observability/logger';

/**
 * The logger is the one place secrets could plausibly escape: a caller passing a
 * whole config object by mistake is a normal thing to do, and the consequence
 * would be a credential in a log aggregator forever.
 */
describe('redact', () => {
  it('redacts by key name, whatever the value looks like', () => {
    const result = redact({
      apiKey: 'anything at all',
      ANTHROPIC_API_KEY: 'x',
      serviceRoleKey: 'y',
      password: 'hunter2',
      authorization: 'Bearer abc',
      sessionToken: 'z',
      ipHashSalt: 'salty',
      cookie: 'a=b',
    }) as Record<string, unknown>;

    for (const value of Object.values(result)) {
      expect(value).toBe('[redacted]');
    }
  });

  it('redacts secret-shaped values even under an innocent key', () => {
    const result = redact({
      note: 'the key is sk-ant-api03-AAAAAAAABBBBBBBBCCCCCCCC and it works',
    }) as Record<string, string>;
    expect(result.note).not.toContain('sk-ant-api03');
    expect(result.note).toContain('[redacted]');
  });

  it('redacts a JWT, which is the shape of a Supabase key', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnop';
    const result = redact({ detail: `token ${jwt} used` }) as Record<string, string>;
    expect(result.detail).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('recurses into nested objects and arrays', () => {
    const result = redact({
      config: { nested: { apiKey: 'secret' } },
      items: [{ token: 'secret' }],
    }) as { config: { nested: { apiKey: string } }; items: { token: string }[] };

    expect(result.config.nested.apiKey).toBe('[redacted]');
    expect(result.items[0]!.token).toBe('[redacted]');
  });

  it('preserves ordinary values', () => {
    const result = redact({ domain: 'example.com', score: 74, ok: true }) as Record<
      string,
      unknown
    >;
    expect(result).toEqual({ domain: 'example.com', score: 74, ok: true });
  });

  it('caps recursion and string length so a log line cannot be unbounded', () => {
    const deep: Record<string, unknown> = {};
    let cursor = deep;
    for (let i = 0; i < 20; i += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => redact(deep)).not.toThrow();

    const long = redact({ text: 'x'.repeat(10_000) }) as { text: string };
    expect(long.text.length).toBeLessThan(3_000);
  });

  it('serialises an Error without leaking a secret from its message', () => {
    const error = new Error('failed with key sk-ant-api03-SECRETSECRETSECRET');
    const result = redact({ error }) as { error: { message: string } };
    expect(result.error.message).not.toContain('SECRETSECRET');
  });
});
