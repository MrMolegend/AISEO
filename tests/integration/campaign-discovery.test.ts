import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCampaignStore,
  resetMemoryCampaignStore,
  resetCampaignStoreCache,
} from '@/lib/campaigns/store';
import {
  getLeadStore,
  resetMemoryLeadStore,
  resetLeadStoreCache,
} from '@/lib/leads/store';
import { getIcpStore, resetMemoryIcpStore, resetIcpStoreCache } from '@/lib/icps/store';
import {
  resetMemoryAltConfigStore,
  resetAltConfigStoreCache,
  getAltConfigStore,
} from '@/lib/alt/config-store';
import { runCampaignDiscovery } from '@/lib/discovery/engine';
import {
  startCampaign,
  previewCampaign,
  repairStalledCampaignRuns,
} from '@/lib/discovery/start';
import { resetResearchProviderCache, FixtureResearchProvider } from '@/lib/research';
import { icpInputSchema } from '@/schemas/icp';
import { campaignInputSchema } from '@/schemas/campaign';

/**
 * The discovery engine, end to end on the deterministic fixture world.
 *
 * The fixture landscape is deliberately imperfect — a duplicate candidate
 * under two legal suffixes, a listicle headline, a candidate with no fit
 * evidence — so these tests prove the engine's honesty rules, not merely
 * that bytes moved.
 */

const MANAGER = '44444444-4444-4444-8444-444444444444';

function resetAll(): void {
  resetMemoryCampaignStore();
  resetCampaignStoreCache();
  resetMemoryLeadStore();
  resetLeadStoreCache();
  resetMemoryIcpStore();
  resetIcpStoreCache();
  resetMemoryAltConfigStore();
  resetAltConfigStoreCache();
  resetResearchProviderCache();
  FixtureResearchProvider.reset();
}

async function createFixtureCampaign(overrides?: {
  budgetUnits?: number;
  maxAccounts?: number;
  segmentKeys?: string[];
}) {
  const icps = await getIcpStore();
  const icp = await icps.create(
    icpInputSchema.parse({
      name: 'UAE pet trade',
      territoryKeys: ['AE-DU', 'AE-AZ'],
      segmentKeys: overrides?.segmentKeys ?? [
        'independent_pet_retail',
        'pet_retail_chain',
        'veterinary_retail',
        'pet_ecommerce',
      ],
      maxAccounts: overrides?.maxAccounts ?? 10,
      researchBudgetUnits: overrides?.budgetUnits ?? 60,
    }),
    MANAGER,
  );

  const campaigns = await getCampaignStore();
  const campaign = await campaigns.create(
    campaignInputSchema.parse({
      name: 'Q3 UAE discovery',
      icpId: icp.id,
      territoryKeys: ['AE-DU'],
      maxAccounts: overrides?.maxAccounts ?? 10,
      maxContactsPerAccount: 3,
      budgetUnits: overrides?.budgetUnits ?? 60,
    }),
    MANAGER,
  );
  return { icp, campaign, campaigns };
}

beforeEach(resetAll);
afterEach(() => {
  vi.useRealTimers();
});

describe('a full discovery run', () => {
  it('discovers, deduplicates, gathers evidence, extracts contacts, and gates honestly', async () => {
    const { campaign, campaigns } = await createFixtureCampaign();
    const { run } = await startCampaign(campaign.id, MANAGER);
    await runCampaignDiscovery(run.id);

    const finished = await campaigns.getRun(run.id);
    expect(finished?.status).toBe('completed');
    expect(finished?.unitsSpent).toBeGreaterThan(0);
    expect(finished?.unitsSpent).toBeLessThanOrEqual(finished!.unitsBudget);

    const leads = await getLeadStore();
    const accounts = await leads.listAccounts({ campaignId: campaign.id });

    // Pet Oasis appears three times in the fixtures under different legal
    // suffixes and sources; exactly one account may exist.
    const oasis = accounts.filter((account) => account.normalizedName === 'pet oasis');
    expect(oasis).toHaveLength(1);

    // The listicle headline never became an account.
    expect(
      accounts.some((account) => /best pet shops/i.test(account.canonicalName)),
    ).toBe(false);

    // Multiple independent identity sources accumulated on the deduped row.
    const oasisClaims = await leads.listClaims(oasis[0]!.id);
    expect(
      oasisClaims.filter((claim) => claim.kind === 'identity').length,
    ).toBeGreaterThanOrEqual(2);
    expect(oasisClaims.every((claim) => claim.sourceUrl.startsWith('https://'))).toBe(
      true,
    );

    // Qualified under 'standard': identity + fit both present.
    expect(oasis[0]!.status).toBe('qualified');
    expect(oasis[0]!.fitRationale).toContain('Identity supported');

    // PetKart has no fit evidence in the fixture world: parked, not faked.
    const petkart = accounts.find(
      (account) => account.normalizedName === 'petkart middle east',
    );
    expect(petkart?.status).toBe('research_needed');
    expect(petkart?.fitRationale).toContain('Needs more research');

    // Contacts came only from structured public snippets, unverified, with
    // no invented channel.
    const contacts = await leads.listContacts(oasis[0]!.id);
    expect(contacts.length).toBeGreaterThanOrEqual(1);
    for (const contact of contacts) {
      expect(contact.employmentConfidence).toBe('unverified');
      expect(contact.contactChannel).toBeNull();
      expect(contact.sourceUrl).toBeTruthy();
      expect(contact.roleRelevance).toBeTruthy();
    }
    const fatima = contacts.find((contact) => contact.fullName === 'Fatima Hassan');
    expect(fatima?.profileUrl).toContain('linkedin.com');
    expect(fatima?.sourceCategory).toBe('public_search_index');
  });

  it('a website is never required: accounts without one still qualify', async () => {
    const { campaign } = await createFixtureCampaign();
    const { run } = await startCampaign(campaign.id, MANAGER);
    await runCampaignDiscovery(run.id);

    const leads = await getLeadStore();
    const accounts = await leads.listAccounts({ campaignId: campaign.id });
    // Whisker & Paw was discovered through a news profile, not its own site.
    const whisker = accounts.find(
      (account) => account.normalizedName === 'whisker paw boutique',
    );
    expect(whisker).toBeTruthy();
    expect(whisker!.status).toBe('qualified');
  });
});

describe('budget discipline', () => {
  it('a run stops at its ceiling and finishes as partial, never overdrawn', async () => {
    const { campaign, campaigns } = await createFixtureCampaign({ budgetUnits: 2 });
    const { run } = await startCampaign(campaign.id, MANAGER);
    await runCampaignDiscovery(run.id);

    const finished = await campaigns.getRun(run.id);
    expect(finished?.status).toBe('partial');
    expect(finished?.unitsSpent).toBeLessThanOrEqual(2);
  });

  it('the preview blocks a start that would breach the daily cap', async () => {
    const config = await getAltConfigStore();
    await config.setConfig(
      'budget_caps',
      { perCampaignUnits: 100, perDayUnits: 10 },
      MANAGER,
    );
    const { campaign } = await createFixtureCampaign({ budgetUnits: 60 });

    const preview = await previewCampaign(campaign.id);
    expect(preview.startable).toBe(false);
    expect(preview.blockedReason).toContain('will not fit');
    await expect(startCampaign(campaign.id, MANAGER)).rejects.toMatchObject({
      code: 'BUDGET_EXCEEDED',
    });
  });

  it('a retry never re-buys evidence it already holds', async () => {
    const { campaign, campaigns } = await createFixtureCampaign();
    const first = await startCampaign(campaign.id, MANAGER);
    await runCampaignDiscovery(first.run.id);
    const firstRun = await campaigns.getRun(first.run.id);

    const leads = await getLeadStore();
    const before = await leads.listAccounts({ campaignId: campaign.id });
    const claimsBefore = await leads.listClaims(before[0]!.id);

    const second = await startCampaign(campaign.id, MANAGER);
    expect(second.duplicate).toBe(false);
    await runCampaignDiscovery(second.run.id);
    const secondRun = await campaigns.getRun(second.run.id);

    // Candidate queries re-run (freshness), but per-account fit and contact
    // searches are skipped for accounts already holding evidence.
    expect(secondRun!.unitsSpent).toBeLessThan(firstRun!.unitsSpent);

    const after = await leads.listAccounts({ campaignId: campaign.id });
    expect(after.length).toBe(before.length);
    const claimsAfter = await leads.listClaims(before[0]!.id);
    expect(claimsAfter.filter((claim) => claim.kind === 'fit').length).toBe(
      claimsBefore.filter((claim) => claim.kind === 'fit').length,
    );
  });
});

describe('run lifecycle', () => {
  it('one active run per campaign: a resubmission joins it', async () => {
    const { campaign } = await createFixtureCampaign();
    const first = await startCampaign(campaign.id, MANAGER);
    const second = await startCampaign(campaign.id, MANAGER);
    expect(second.duplicate).toBe(true);
    expect(second.run.id).toBe(first.run.id);
  });

  it('a cancelled run stays cancelled even if the engine finishes late', async () => {
    const { campaign, campaigns } = await createFixtureCampaign();
    const { run } = await startCampaign(campaign.id, MANAGER);

    await campaigns.finishRun(run.id, 'cancelled');
    await runCampaignDiscovery(run.id);

    const finished = await campaigns.getRun(run.id);
    expect(finished?.status).toBe('cancelled');
  });

  it('the stall sweep fails silent runs exactly once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T08:00:00Z'));

    const { campaign, campaigns } = await createFixtureCampaign();
    const { run } = await startCampaign(campaign.id, MANAGER);

    vi.setSystemTime(new Date('2026-09-04T08:20:00Z'));
    const repaired = await repairStalledCampaignRuns();
    expect(repaired).toBe(1);

    const failed = await campaigns.getRun(run.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.errorCode).toBe('JOB_STALLED');

    // A second sweep finds nothing: the repair is not repeatable damage.
    expect(await repairStalledCampaignRuns()).toBe(0);
  });
});
