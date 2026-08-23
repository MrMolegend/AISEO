import { describe, expect, it } from 'vitest';
import { leadSchema, MIN_HUMAN_FORM_MS } from '@/schemas/api';

describe('leadSchema', () => {
  const valid = {
    name: 'Alex Harrington',
    email: 'alex@example.com',
    company: 'Harrington Ltd',
    website: 'harrington.example',
    message: 'We would like help with the technical fixes.',
  };

  it('accepts a complete submission', () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a minimal submission — only name and email are required', () => {
    expect(leadSchema.safeParse({ name: 'Alex', email: 'a@b.co' }).success).toBe(true);
  });

  it('accepts empty strings for optional fields, as an unfilled form sends them', () => {
    const result = leadSchema.safeParse({
      name: 'Alex',
      email: 'a@b.co',
      company: '',
      website: '',
      message: '',
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ['', 'name'],
    ['   ', 'name'],
  ])('rejects a blank name %j', (name) => {
    expect(leadSchema.safeParse({ ...valid, name }).success).toBe(false);
  });

  it.each(['not-an-email', 'missing@', '@missing.com', 'spaces in@email.com'])(
    'rejects the malformed email %j',
    (email) => {
      expect(leadSchema.safeParse({ ...valid, email }).success).toBe(false);
    },
  );

  it('caps every field so a submission cannot be used to store bulk data', () => {
    expect(leadSchema.safeParse({ ...valid, name: 'x'.repeat(200) }).success).toBe(false);
    expect(leadSchema.safeParse({ ...valid, message: 'x'.repeat(5_000) }).success).toBe(
      false,
    );
  });

  it('carries the honeypot field so the route can inspect it', () => {
    const result = leadSchema.safeParse({
      ...valid,
      companyWebsiteUrl: 'bot filled this',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.companyWebsiteUrl).toBe('bot filled this');
  });

  it('carries the time-on-form so the route can reject instant submissions', () => {
    const result = leadSchema.safeParse({ ...valid, elapsedMs: 40 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.elapsedMs).toBeLessThan(MIN_HUMAN_FORM_MS);
  });

  it('trims surrounding whitespace', () => {
    const result = leadSchema.safeParse({ ...valid, name: '  Alex  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Alex');
  });
});
