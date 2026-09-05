import { describe, it, expect } from 'vitest';
import {
  normalizeAccountName,
  canonicalDomain,
  candidateFromResult,
  sameOrganisation,
} from '@/lib/leads/normalize';
import { contactFromResult } from '@/lib/discovery/contacts';
import { buildDiscoveryPlan, estimateCost } from '@/lib/discovery/plan';
import type { SearchResult } from '@/lib/research/provider';

function result(title: string, url: string, excerpt = 'x'): SearchResult {
  return { title, url, excerpt, publishedDate: null, score: 0.8 };
}

describe('account normalisation', () => {
  it('strips legal suffixes so the same business collapses to one key', () => {
    expect(normalizeAccountName('Pet Oasis Trading LLC')).toBe('pet oasis');
    expect(normalizeAccountName('Pet Oasis')).toBe('pet oasis');
    expect(normalizeAccountName('PET OASIS TRADING L.L.C')).toBe('pet oasis');
  });

  it('never treats similar-but-different names as the same organisation', () => {
    const oasis = { normalizedName: 'pet oasis', domain: null };
    const paradise = { normalizedName: 'pet paradise', domain: null };
    expect(sameOrganisation(oasis, paradise)).toBeNull();
  });

  it('matches on canonical domain, and says which rule matched', () => {
    const a = { normalizedName: 'pet oasis', domain: 'petoasis.example' };
    const b = { normalizedName: 'oasis pet supplies', domain: 'petoasis.example' };
    expect(sameOrganisation(a, b)).toBe('domain');
    expect(sameOrganisation(a, { ...a, domain: null })).toBe('name');
  });

  it('platform hosts never become an account domain', () => {
    expect(canonicalDomain('https://www.linkedin.com/company/x')).toBeNull();
    expect(canonicalDomain('https://dubaiyellowpages.example/listings/x')).toBeNull();
    expect(canonicalDomain('https://www.petoasis.example/about')).toBe(
      'petoasis.example',
    );
  });
});

describe('candidate extraction', () => {
  it('reads the name segment a publisher actually wrote', () => {
    const candidate = candidateFromResult(
      result(
        'Pet Oasis Trading LLC | Dubai Pet Shops Directory',
        'https://dubaiyellowpages.example/listings/pet-oasis',
      ),
    );
    expect(candidate?.name).toBe('Pet Oasis Trading LLC');
    expect(candidate?.normalizedName).toBe('pet oasis');
    expect(candidate?.domain).toBeNull();
  });

  it('refuses listicles, questions and sentences — silence, not invention', () => {
    expect(
      candidateFromResult(
        result('The 10 best pet shops in Dubai | Weekly', 'https://a.example/x'),
      ),
    ).toBeNull();
    expect(
      candidateFromResult(
        result('Where to buy pet food in Sharjah? - Forum', 'https://b.example/x'),
      ),
    ).toBeNull();
  });
});

describe('contact extraction', () => {
  const account = 'pet oasis';

  it('requires name, relevant role and matching company in one structured title', () => {
    const contact = contactFromResult(
      result(
        'Fatima Hassan – Purchasing Manager – Pet Oasis Trading | LinkedIn',
        'https://www.linkedin.com/in/fatima-fixture',
      ),
      account,
    );
    expect(contact?.fullName).toBe('Fatima Hassan');
    expect(contact?.roleTitle).toBe('Purchasing Manager');
    expect(contact?.profileUrl).toContain('linkedin.com');
    expect(contact?.roleRelevance).toContain('purchasing');
  });

  it('rejects a wrong company, an irrelevant role, and a non-name', () => {
    expect(
      contactFromResult(
        result(
          'Fatima Hassan – Purchasing Manager – Different Firm | LinkedIn',
          'https://www.linkedin.com/in/x',
        ),
        account,
      ),
    ).toBeNull();
    expect(
      contactFromResult(
        result(
          'Fatima Hassan – Wildlife Photographer – Pet Oasis Trading | LinkedIn',
          'https://www.linkedin.com/in/x',
        ),
        account,
      ),
    ).toBeNull();
    expect(
      contactFromResult(
        result(
          'best deals – Purchasing Manager – Pet Oasis Trading',
          'https://a.example/x',
        ),
        account,
      ),
    ).toBeNull();
  });

  it('never invents a contact channel: extraction has no field for one', () => {
    const contact = contactFromResult(
      result(
        'Omar Al Farsi – Founder – Pet Oasis Trading | LinkedIn',
        'https://www.linkedin.com/in/omar-fixture',
      ),
      account,
    );
    expect(contact).not.toBeNull();
    expect(Object.keys(contact!)).not.toContain('email');
    expect(Object.keys(contact!)).not.toContain('phone');
    expect(Object.keys(contact!)).not.toContain('contactChannel');
  });
});

describe('the discovery plan and its price', () => {
  const territories = [
    {
      key: 'AE',
      name: 'United Arab Emirates',
      kind: 'country' as const,
      parentKey: null,
      active: true,
    },
    {
      key: 'AE-DU',
      name: 'Dubai',
      kind: 'emirate' as const,
      parentKey: 'AE',
      active: true,
    },
  ];

  it('is deterministic from campaign and profile, and bounded', () => {
    const plan = buildDiscoveryPlan(
      { territoryKeys: ['AE-DU'], maxContactsPerAccount: 3 },
      { segmentKeys: ['independent_pet_retail', 'pet_ecommerce'] },
      territories,
    );
    expect(plan.candidateQueries).toHaveLength(2);
    expect(plan.candidateQueries[0]!.query).toContain('Dubai');
    expect(plan.candidateQueries[0]!.area).toBe(
      'discovery:candidates:independent_pet_retail',
    );
  });

  it('prices the plan as an upper bound, clipped by the budget', () => {
    const plan = buildDiscoveryPlan(
      { territoryKeys: ['AE-DU'], maxContactsPerAccount: 3 },
      { segmentKeys: ['independent_pet_retail'] },
      territories,
    );
    const estimate = estimateCost(plan, { maxAccounts: 10, budgetUnits: 5 });
    expect(estimate.planned).toBe(1 + 10 + 10);
    expect(estimate.chargeableCeiling).toBe(5);
    expect(estimate.clipped).toBe(true);

    const roomy = estimateCost(plan, { maxAccounts: 10, budgetUnits: 100 });
    expect(roomy.chargeableCeiling).toBe(21);
    expect(roomy.clipped).toBe(false);
  });
});
