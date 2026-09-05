import { describe, it, expect } from 'vitest';
import { sanitiseDraftPayload, MAX_DRAFT_BYTES } from '@/lib/validation/draft';

/**
 * Draft payload hygiene: bounded, field-scoped, tolerant of the half-typed.
 */

describe('sanitiseDraftPayload', () => {
  it('keeps known fields exactly as typed, including invalid-but-honest values', () => {
    const cleaned = sanitiseDraftPayload({
      businessName: 'Ardmore',
      currentPrice: '12.5',
      minimumOrderQuantity: 48,
      targetRegion: null,
      knownCompetitors: ['Maldon', 'Halen Môn'],
    });
    expect(cleaned).toEqual({
      businessName: 'Ardmore',
      currentPrice: '12.5',
      minimumOrderQuantity: 48,
      targetRegion: null,
      knownCompetitors: ['Maldon', 'Halen Môn'],
    });
  });

  it('drops fields the intake does not own', () => {
    const cleaned = sanitiseDraftPayload({
      businessName: 'Ardmore',
      role: 'admin',
      __proto__constructor: 'x',
      website: 'https://evil.example',
      nested: { anything: true },
    });
    expect(cleaned).toEqual({ businessName: 'Ardmore' });
  });

  it('bounds strings and arrays instead of trusting them', () => {
    const cleaned = sanitiseDraftPayload({
      additionalContext: 'a'.repeat(10_000),
      knownCompetitors: Array.from({ length: 50 }, (_, i) => `c${i}`.repeat(400)),
    });
    expect((cleaned!.additionalContext as string).length).toBe(4_000);
    const competitors = cleaned!.knownCompetitors as string[];
    expect(competitors).toHaveLength(20);
    expect(competitors.every((item) => item.length <= 300)).toBe(true);
  });

  it('refuses non-objects and payloads that stay too large after cleaning', () => {
    expect(sanitiseDraftPayload(null)).toBeNull();
    expect(sanitiseDraftPayload('a string')).toBeNull();
    expect(sanitiseDraftPayload([1, 2, 3])).toBeNull();

    // Many fields, each at its individual cap, exceeding the overall ceiling.
    const bloated: Record<string, string> = {};
    for (const key of [
      'offerDescription',
      'supplyArrangements',
      'productCharacteristics',
      'customerDescription',
      'marketReason',
      'existingContacts',
      'knownRegulations',
      'additionalContext',
      'primaryObjective',
      'biggestConcern',
    ]) {
      bloated[key] = 'x'.repeat(4_000);
    }
    expect(JSON.stringify(bloated).length).toBeGreaterThan(MAX_DRAFT_BYTES);
    expect(sanitiseDraftPayload(bloated)).toBeNull();
  });
});
