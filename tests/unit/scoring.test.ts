import { describe, it, expect, beforeEach } from 'vitest';
import { computeAccountScore, type ScoringInputs } from '@/lib/scoring/compute';
import { matchBrands } from '@/lib/scoring/matching';
import { DEFAULT_SCORING_WEIGHTS, SCORE_DIMENSIONS } from '@/schemas/alt-config';
import {
  getScoreStore,
  resetMemoryScoreStore,
  resetScoreStoreCache,
} from '@/lib/scoring/store';
import type { LeadClaimRecord } from '@/lib/leads/store';
import type { BrandRecord } from '@/lib/alt/config-store';

/**
 * The deterministic scoring layer.
 *
 * Same inputs, same number, always; every component carries its stated
 * rule's explanation; missing inputs depress the total instead of being
 * excused; overrides preserve the computed value. And matching never
 * confuses "no evidence" with "observed gap".
 */

const NOW = new Date('2026-09-04T12:00:00Z');

function claim(partial: Partial<LeadClaimRecord>): LeadClaimRecord {
  return {
    id: crypto.randomUUID(),
    accountId: 'a',
    kind: 'fit',
    text: 'Premium dog and cat nutrition on the shelves.',
    sourceUrl: 'https://petoasis.example/brands',
    sourceTitle: 'Brands',
    sourceCategory: 'company_website',
    retrievalMode: 'indexed',
    confidence: 'medium',
    contentDate: null,
    retrievedAt: '2026-09-01T00:00:00.000Z',
    ...partial,
  };
}

function baseInputs(overrides?: Partial<ScoringInputs>): ScoringInputs {
  return {
    account: { segmentKey: 'independent_pet_retail', territoryKey: 'AE-DU' },
    icp: {
      segmentKeys: ['independent_pet_retail'],
      territoryKeys: ['AE-DU'],
      criteria: null as never,
    },
    claims: [
      claim({ kind: 'identity', sourceUrl: 'https://directory.example/x' }),
      claim({ kind: 'fit' }),
    ],
    contacts: [],
    relationships: [],
    productMatches: null,
    weights: { ...DEFAULT_SCORING_WEIGHTS },
    now: NOW,
    ...overrides,
  };
}

beforeEach(() => {
  resetMemoryScoreStore();
  resetScoreStoreCache();
});

describe('the arithmetic', () => {
  it('is deterministic: same inputs, same number, component for component', () => {
    const first = computeAccountScore(baseInputs());
    const second = computeAccountScore(baseInputs());
    expect(second).toEqual(first);
  });

  it('covers every dimension, each with an explanation', () => {
    const { components } = computeAccountScore(baseInputs());
    expect(components.map((component) => component.dimension)).toEqual([
      ...SCORE_DIMENSIONS,
    ]);
    for (const component of components) {
      expect(component.explanation.length).toBeGreaterThan(10);
      expect(component.weighted).toBe(component.raw * component.weight);
    }
  });

  it('missing inputs are named and depress the total rather than being excused', () => {
    const known = computeAccountScore(baseInputs());
    const unknownSegment = computeAccountScore(
      baseInputs({ account: { segmentKey: null, territoryKey: 'AE-DU' } }),
    );
    expect(unknownSegment.total).toBeLessThan(known.total);

    const fitComponent = unknownSegment.components.find(
      (component) => component.dimension === 'account_fit',
    )!;
    expect(fitComponent.missing).toBe(true);
    expect(fitComponent.missingInputs).toContain('segment');
    expect(fitComponent.raw).toBe(0);
  });

  it('an empty catalogue reads as a missing input, not a zero opportunity', () => {
    const { components } = computeAccountScore(baseInputs({ productMatches: null }));
    const match = components.find(
      (component) => component.dimension === 'product_match',
    )!;
    expect(match.missing).toBe(true);
    expect(match.explanation).toContain('catalogue is empty');
  });

  it('a verified direct connection outranks unconfirmed context, which outranks nothing', () => {
    const nothing = computeAccountScore(baseInputs());
    const context = computeAccountScore(
      baseInputs({
        relationships: [
          {
            state: 'public_shared_context',
          } as never,
        ],
      }),
    );
    const direct = computeAccountScore(
      baseInputs({
        relationships: [
          {
            state: 'employee_confirmed_direct',
          } as never,
        ],
      }),
    );
    const strength = (score: ReturnType<typeof computeAccountScore>) =>
      score.components.find(
        (component) => component.dimension === 'relationship_strength',
      )!.raw;
    expect(strength(nothing)).toBe(0);
    expect(strength(context)).toBe(20);
    expect(strength(direct)).toBe(100);
  });
});

describe('overrides', () => {
  it('preserve the computed total, demand pairing rules, and clear cleanly', async () => {
    const store = await getScoreStore();
    const computed = computeAccountScore(baseInputs());
    await store.upsertComputed('acc-1', computed);

    const overridden = await store.setOverride('acc-1', {
      total: 90,
      reason: 'Met the buyer at the Riyadh expo; deal in motion.',
      by: 'manager-1',
    });
    expect(overridden?.overrideTotal).toBe(90);
    expect(overridden?.total).toBe(computed.total);

    // A recompute keeps the override standing beside the fresh arithmetic.
    const recomputed = await store.upsertComputed('acc-1', computed);
    expect(recomputed.overrideTotal).toBe(90);
    expect(recomputed.overrideReason).toContain('Riyadh');

    const cleared = await store.setOverride('acc-1', null);
    expect(cleared?.overrideTotal).toBeNull();
    expect(cleared?.total).toBe(computed.total);
  });
});

describe('catalogue matching', () => {
  const brand = (partial: Partial<BrandRecord>): BrandRecord => ({
    id: crypto.randomUUID(),
    name: 'Example Premium Dog',
    categories: ['dog food'],
    positioning: 'premium',
    exclusivityNotes: '',
    source: 'alt_admin',
    recordedOn: '2026-09-04',
    active: true,
    createdAt: '2026-09-04T00:00:00Z',
    updatedAt: '2026-09-04T00:00:00Z',
    ...partial,
  });

  it('distinguishes already-stocked, observed opportunity, and not-verified', () => {
    const claims = [
      claim({ text: 'Shelves carry Example Premium Dog and store-brand treats.' }),
      claim({ text: 'A growing cat litter section with mid-market brands.' }),
    ];
    const matches = matchBrands({ territoryKey: 'AE-DU' }, claims, [
      brand({ name: 'Example Premium Dog', categories: ['dog food'] }),
      brand({ name: 'LitterCo', categories: ['cat litter'] }),
      brand({ name: 'AquaBrand', categories: ['aquatics'] }),
    ]);

    expect(matches[0]).toMatchObject({ verdict: 'already_stocked' });
    expect(matches[0]!.evidenceClaimIds.length).toBeGreaterThan(0);
    expect(matches[1]).toMatchObject({ verdict: 'observed_opportunity' });
    expect(matches[2]).toMatchObject({ verdict: 'not_verified' });
    expect(matches[2]!.explanation).toContain('not the same as a gap');
    expect(matches[2]!.evidenceClaimIds).toHaveLength(0);
  });

  it('never suggests a restricted brand-territory combination', () => {
    const matches = matchBrands(
      { territoryKey: 'AE-DU' },
      [claim({ text: 'Dog food everywhere.' })],
      [
        brand({
          name: 'ExclusiveBrand',
          categories: ['dog food'],
          exclusivityNotes: 'Exclusive to a distributor in AE-DU until 2027-01-01.',
        }),
      ],
    );
    expect(matches[0]).toMatchObject({ verdict: 'restricted' });
    expect(matches[0]!.explanation).toContain('never suggested');
  });
});
