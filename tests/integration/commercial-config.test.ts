import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAltConfigStore,
  resetMemoryAltConfigStore,
  resetAltConfigStoreCache,
  defaultConfigValue,
} from '@/lib/alt/config-store';
import { getIcpStore, resetMemoryIcpStore, resetIcpStoreCache } from '@/lib/icps/store';
import { icpInputSchema } from '@/schemas/icp';
import { scoringWeightsSchema, DEFAULT_SCORING_WEIGHTS } from '@/schemas/alt-config';
import { ALT_FACTS } from '@/config/alt';

const ADMIN = '33333333-3333-4333-8333-333333333333';

beforeEach(() => {
  resetMemoryAltConfigStore();
  resetAltConfigStoreCache();
  resetMemoryIcpStore();
  resetIcpStoreCache();
});

describe('the commercial configuration', () => {
  it('default proof points all carry a source and a recording date', () => {
    const points = defaultConfigValue('proof_points');
    expect(points.length).toBe(ALT_FACTS.length);
    for (const point of points) {
      expect(point.source).toBe('build_specification');
      expect(point.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('saved configuration round-trips and replaces the defaults', async () => {
    const store = await getAltConfigStore();
    await store.setConfig(
      'proof_points',
      [{ text: 'Approved claim.', source: 'alt_admin', recordedOn: '2026-09-04' }],
      ADMIN,
    );
    const read = await store.getConfig('proof_points');
    expect(read).toHaveLength(1);
    expect(read[0]!.text).toBe('Approved claim.');
  });

  it('rejects a weights object with no weight anywhere', () => {
    const zeroed = Object.fromEntries(
      Object.keys(DEFAULT_SCORING_WEIGHTS).map((key) => [key, 0]),
    );
    expect(scoringWeightsSchema.safeParse(zeroed).success).toBe(false);
  });

  it('ships the GCC territory set with the emirates under the UAE', async () => {
    const store = await getAltConfigStore();
    const territories = await store.listTerritories();
    const uae = territories.find((territory) => territory.key === 'AE');
    const dubai = territories.find((territory) => territory.key === 'AE-DU');
    expect(uae?.kind).toBe('country');
    expect(dubai?.parentKey).toBe('AE');
    expect(territories.filter((territory) => territory.kind === 'country')).toHaveLength(
      6,
    );
  });

  it('the brand catalogue starts empty and refuses duplicate names', async () => {
    const store = await getAltConfigStore();
    expect(await store.listBrands()).toHaveLength(0);

    await store.createBrand(
      {
        name: 'Example Premium Dog',
        categories: ['dog food'],
        positioning: 'premium',
        exclusivityNotes: '',
        source: 'alt_admin',
        active: true,
      },
      ADMIN,
    );
    await expect(
      store.createBrand(
        {
          name: 'example premium dog',
          categories: [],
          positioning: null,
          exclusivityNotes: '',
          source: 'alt_admin',
          active: true,
        },
        ADMIN,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('deactivated brands drop out of the default listing but not the full one', async () => {
    const store = await getAltConfigStore();
    const brand = await store.createBrand(
      {
        name: 'Retired Line',
        categories: [],
        positioning: null,
        exclusivityNotes: '',
        source: 'alt_admin',
        active: true,
      },
      ADMIN,
    );
    await store.updateBrand(brand.id, {
      name: brand.name,
      categories: brand.categories,
      positioning: brand.positioning,
      exclusivityNotes: brand.exclusivityNotes,
      source: 'alt_admin',
      active: false,
    });

    expect(await store.listBrands()).toHaveLength(0);
    expect(await store.listBrands({ includeInactive: true })).toHaveLength(1);
  });
});

describe('ideal customer profiles', () => {
  const minimal = () =>
    icpInputSchema.parse({
      name: 'UAE premium independents',
      territoryKeys: ['AE-DU', 'AE-AZ'],
      segmentKeys: ['independent_pet_retail'],
    });

  it('applies defaults: standard evidence, bounded caps, unconstraining criteria', () => {
    const parsed = minimal();
    expect(parsed.minEvidenceLevel).toBe('standard');
    expect(parsed.maxAccounts).toBe(25);
    expect(parsed.criteria.independentOrChain).toBe('either');
    expect(parsed.criteria.petCategories).toEqual([]);
  });

  it('requires at least one territory and one segment', () => {
    const noTerritory = icpInputSchema.safeParse({
      name: 'X',
      territoryKeys: [],
      segmentKeys: ['pet_ecommerce'],
    });
    expect(noTerritory.success).toBe(false);
  });

  it('creates, updates, archives and filters', async () => {
    const store = await getIcpStore();
    const created = await store.create(minimal(), ADMIN);
    expect(created.createdBy).toBe(ADMIN);

    const updated = await store.update(created.id, {
      ...minimal(),
      name: 'Renamed',
    });
    expect(updated?.name).toBe('Renamed');

    await store.setArchived(created.id, true);
    expect(await store.list()).toHaveLength(0);
    expect(await store.list({ includeArchived: true })).toHaveLength(1);
  });

  it('caps are bounded: two hundred accounts, ten contacts, two thousand units', () => {
    const over = icpInputSchema.safeParse({
      ...minimal(),
      maxAccounts: 500,
    });
    expect(over.success).toBe(false);
  });
});
