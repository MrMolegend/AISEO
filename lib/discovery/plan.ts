import type { IcpRecord } from '@/lib/icps/store';
import type { CampaignRecord } from '@/lib/campaigns/store';
import type { TerritoryRecord } from '@/lib/alt/config-store';
import { SEGMENT_LABEL, type SegmentKey } from '@/config/alt';

/**
 * Discovery planning — pure functions, no I/O.
 *
 * A campaign's research is priced BEFORE it runs: the plan is deterministic
 * from the campaign and its ICP, so the preview a manager confirms is the
 * plan the engine executes, and the estimate is an upper bound the budget
 * cap then clips. One research unit = one provider search.
 */

export interface PlannedQuery {
  query: string;
  /** Keys the deterministic fixture provider; advisory for live search. */
  area: string;
  segmentKey: string;
  territoryKey: string;
}

export interface DiscoveryPlan {
  candidateQueries: PlannedQuery[];
  /** Per selected account: one fit-evidence search. */
  fitSearchesPerAccount: 1;
  /** Per selected account: one decision-maker search, when contacts wanted. */
  contactSearchesPerAccount: 0 | 1;
}

export interface CostEstimate {
  candidateSearches: number;
  fitSearches: number;
  contactSearches: number;
  /** The uncapped sum. */
  planned: number;
  /** What the run may actually spend: min(planned, budget). */
  chargeableCeiling: number;
  budgetUnits: number;
  /** True when the budget cannot cover the full plan. */
  clipped: boolean;
}

/** How many territory×segment pairs one campaign will search, at most. */
const MAX_CANDIDATE_QUERIES = 12;

const SEGMENT_SEARCH_TERM: Record<string, string> = {
  independent_pet_retail: 'independent pet shop',
  pet_retail_chain: 'pet store chain',
  veterinary_retail: 'veterinary clinic pet pharmacy',
  grooming_petcare_retail: 'pet grooming centre retail',
  pet_ecommerce: 'online pet supplies store',
  grocery_pet_category: 'supermarket pet section',
  speciality_exotics_retail: 'aquatics reptile bird shop',
  boarding_breeding_shelter: 'kennel cattery boarding',
  regional_distribution: 'pet products distributor',
  hospitality_lifestyle: 'pet friendly retail operator',
};

export function buildDiscoveryPlan(
  campaign: Pick<CampaignRecord, 'territoryKeys' | 'maxContactsPerAccount'>,
  icp: Pick<IcpRecord, 'segmentKeys'>,
  territories: TerritoryRecord[],
): DiscoveryPlan {
  const territoryName = new Map(territories.map((t) => [t.key, t.name]));
  const candidateQueries: PlannedQuery[] = [];

  outer: for (const segmentKey of icp.segmentKeys) {
    for (const territoryKey of campaign.territoryKeys) {
      if (candidateQueries.length >= MAX_CANDIDATE_QUERIES) break outer;
      const place = territoryName.get(territoryKey) ?? territoryKey;
      const term =
        SEGMENT_SEARCH_TERM[segmentKey] ??
        SEGMENT_LABEL[segmentKey as SegmentKey]?.toLowerCase() ??
        segmentKey.replace(/_/g, ' ');
      candidateQueries.push({
        query: `${term} ${place} directory`,
        area: `discovery:candidates:${segmentKey}`,
        segmentKey,
        territoryKey,
      });
    }
  }

  return {
    candidateQueries,
    fitSearchesPerAccount: 1,
    contactSearchesPerAccount: campaign.maxContactsPerAccount > 0 ? 1 : 0,
  };
}

export function estimateCost(
  plan: DiscoveryPlan,
  campaign: Pick<CampaignRecord, 'maxAccounts' | 'budgetUnits'>,
): CostEstimate {
  const candidateSearches = plan.candidateQueries.length;
  const fitSearches = campaign.maxAccounts * plan.fitSearchesPerAccount;
  const contactSearches = campaign.maxAccounts * plan.contactSearchesPerAccount;
  const planned = candidateSearches + fitSearches + contactSearches;
  const chargeableCeiling = Math.min(planned, campaign.budgetUnits);

  return {
    candidateSearches,
    fitSearches,
    contactSearches,
    planned,
    chargeableCeiling,
    budgetUnits: campaign.budgetUnits,
    clipped: planned > campaign.budgetUnits,
  };
}
