import { describe, it, expect } from 'vitest';
import { businessProfileSchema } from '@/schemas/business-profile';

/**
 * The profile schema's promises: a website is optional and stays optional,
 * lenient entry normalises to a strict stored shape, and multi-value fields
 * are bounded and deduplicated somewhere trustworthy.
 */

describe('business profile schema', () => {
  it('accepts a complete profile with no website at all', () => {
    const parsed = businessProfileSchema.parse({
      name: 'Maldon Salt Co',
      description: 'Flaky sea salt from the Blackwater estuary.',
      homeCountry: 'gb',
      offerings: ['Flaky sea salt', 'Smoked salt'],
      knownCompetitors: ['Cornish Sea Salt'],
    });
    expect(parsed.websiteUrl).toBeNull();
    expect(parsed.homeCountry).toBe('GB');
  });

  it('normalises a bare domain to an absolute https URL', () => {
    const parsed = businessProfileSchema.parse({
      name: 'Maldon',
      websiteUrl: 'maldonsalt.example',
    });
    expect(parsed.websiteUrl).toBe('https://maldonsalt.example/');
  });

  it('treats an empty website as absent, not as an error', () => {
    const parsed = businessProfileSchema.parse({ name: 'Maldon', websiteUrl: '   ' });
    expect(parsed.websiteUrl).toBeNull();
  });

  it('rejects a website that is not a web address', () => {
    for (const bad of [
      'ftp://example.com',
      'javascript:alert(1)',
      'not a url',
      'localhost',
    ]) {
      const result = businessProfileSchema.safeParse({ name: 'Maldon', websiteUrl: bad });
      expect(result.success, `expected rejection for ${bad}`).toBe(false);
      if (!result.success) {
        // The message speaks to a customer, never about URL grammar internals.
        const message = result.error.issues[0]!.message;
        expect(message).not.toMatch(/invalid input|expected/i);
      }
    }
  });

  it('never requires the website to make any other field valid', () => {
    // The minimal valid profile is a name alone.
    expect(businessProfileSchema.safeParse({ name: 'Al Dana Trading' }).success).toBe(
      true,
    );
  });

  it('deduplicates chip fields case-insensitively and preserves spaces in names', () => {
    const parsed = businessProfileSchema.parse({
      name: 'Maldon',
      knownCompetitors: ['Cornish  Sea Salt', 'cornish sea salt', 'Halen Môn'],
    });
    expect(parsed.knownCompetitors).toEqual(['Cornish Sea Salt', 'Halen Môn']);
  });

  it('bounds chip lists with a customer-facing message', () => {
    const result = businessProfileSchema.safeParse({
      name: 'Maldon',
      goals: Array.from({ length: 9 }, (_, i) => `Goal ${i}`),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain('8');
    }
  });
});
