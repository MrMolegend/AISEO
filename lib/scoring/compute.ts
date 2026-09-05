import {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_LABEL,
  type ScoreDimension,
  type ScoringWeights,
} from '@/schemas/alt-config';
import type {
  LeadAccountRecord,
  LeadClaimRecord,
  LeadContactRecord,
} from '@/lib/leads/store';
import type { RelationshipRecord } from '@/lib/relationships/store';
import type { IcpRecord } from '@/lib/icps/store';
import { isWarmPath } from '@/schemas/relationship';

/**
 * Deterministic account scoring — pure functions, no I/O, no model.
 *
 * Every dimension's raw signal comes from a stated rule over stored
 * evidence, carries a one-sentence explanation, and lists what was missing.
 * A missing input contributes zero and STAYS IN THE DENOMINATOR: unknowns
 * depress a score rather than being quietly excused, because "we don't
 * know" is a fact about the account's readiness, not noise.
 *
 * AI never participates here. It may (elsewhere) surface candidate signals
 * as claims with sources; the arithmetic that becomes a number is this
 * file, and only this file.
 */

export interface ScoreComponent {
  dimension: ScoreDimension;
  label: string;
  /** 0–100 signal from the stated rule. Zero when missing. */
  raw: number;
  weight: number;
  /** raw × weight; the total normalises by the weight sum. */
  weighted: number;
  explanation: string;
  missing: boolean;
  missingInputs: string[];
}

export interface ComputedScore {
  total: number;
  components: ScoreComponent[];
  weightsUsed: ScoringWeights;
  computedAt: string;
}

export interface ScoringInputs {
  account: Pick<LeadAccountRecord, 'segmentKey' | 'territoryKey'>;
  icp: Pick<IcpRecord, 'segmentKeys' | 'territoryKeys' | 'criteria'>;
  claims: LeadClaimRecord[];
  contacts: LeadContactRecord[];
  relationships: RelationshipRecord[];
  /** Verdicts from lib/scoring/matching.ts, when the catalogue has entries. */
  productMatches: { verdict: string }[] | null;
  weights: ScoringWeights;
  now: Date;
}

interface Signal {
  raw: number;
  explanation: string;
  missing?: boolean;
  missingInputs?: string[];
}

function distinctHosts(claims: LeadClaimRecord[]): number {
  const hosts = new Set<string>();
  for (const claim of claims) {
    try {
      hosts.add(new URL(claim.sourceUrl).hostname);
    } catch {
      hosts.add(claim.sourceUrl);
    }
  }
  return hosts.size;
}

function signalFor(dimension: ScoreDimension, inputs: ScoringInputs): Signal {
  const { account, icp, claims, contacts, relationships } = inputs;
  const fit = claims.filter((claim) => claim.kind === 'fit');
  const identity = claims.filter((claim) => claim.kind === 'identity');

  switch (dimension) {
    case 'account_fit': {
      if (!account.segmentKey) {
        return {
          raw: 0,
          explanation: 'The segment is unknown, so fit cannot be assessed.',
          missing: true,
          missingInputs: ['segment'],
        };
      }
      const matches = icp.segmentKeys.includes(account.segmentKey);
      return {
        raw: matches ? 100 : 0,
        explanation: matches
          ? 'The segment is one the profile targets.'
          : 'The segment is outside the profile’s target segments.',
      };
    }
    case 'commercial_opportunity': {
      if (fit.length === 0) {
        return {
          raw: 0,
          explanation: 'No fit evidence gathered yet.',
          missing: true,
          missingInputs: ['fit evidence'],
        };
      }
      const raw = Math.min(100, fit.length * 34);
      return {
        raw,
        explanation: `${fit.length} piece${fit.length === 1 ? '' : 's'} of assortment or demand evidence on file.`,
      };
    }
    case 'product_match': {
      if (inputs.productMatches === null) {
        return {
          raw: 0,
          explanation: 'The brand catalogue is empty, so no match can be computed.',
          missing: true,
          missingInputs: ['brand catalogue'],
        };
      }
      const opportunities = inputs.productMatches.filter(
        (match) => match.verdict === 'observed_opportunity',
      ).length;
      if (opportunities === 0) {
        return {
          raw: 0,
          explanation: 'No evidenced opportunity against the current catalogue.',
        };
      }
      return {
        raw: Math.min(100, opportunities * 50),
        explanation: `${opportunities} evidenced catalogue opportunit${opportunities === 1 ? 'y' : 'ies'}.`,
      };
    }
    case 'scale_potential': {
      if (!account.segmentKey) {
        return {
          raw: 0,
          explanation: 'Scale cannot be judged without a segment.',
          missing: true,
          missingInputs: ['segment'],
        };
      }
      const multiSite = [
        'pet_retail_chain',
        'grocery_pet_category',
        'regional_distribution',
        'pet_ecommerce',
      ].includes(account.segmentKey);
      return {
        raw: multiSite ? 80 : 40,
        explanation: multiSite
          ? 'The segment typically operates multiple sites or wide reach.'
          : 'The segment is typically single-site; steady rather than large.',
      };
    }
    case 'territory_relevance': {
      if (!account.territoryKey) {
        return {
          raw: 0,
          explanation: 'The territory is unknown.',
          missing: true,
          missingInputs: ['territory'],
        };
      }
      const inside = icp.territoryKeys.includes(account.territoryKey);
      return {
        raw: inside ? 100 : 0,
        explanation: inside
          ? 'Inside the profile’s territories.'
          : 'Outside the profile’s territories.',
      };
    }
    case 'buyer_accessibility': {
      if (contacts.length === 0) {
        return {
          raw: 0,
          explanation: 'No decision-maker found in public sources yet.',
        };
      }
      return {
        raw: Math.min(100, 50 + (contacts.length - 1) * 25),
        explanation: `${contacts.length} sourced decision-maker${contacts.length === 1 ? '' : 's'} on file.`,
      };
    }
    case 'relationship_strength': {
      const states = relationships.map((edge) => edge.state);
      if (
        states.includes('official_api_verified_direct') ||
        states.includes('employee_confirmed_direct')
      ) {
        return { raw: 100, explanation: 'A verified direct connection exists.' };
      }
      if (states.some((state) => isWarmPath(state))) {
        return {
          raw: 70,
          explanation: 'A confirmed indirect path or recorded history exists.',
        };
      }
      if (
        states.includes('public_shared_context') ||
        states.includes('possible_unverified')
      ) {
        return {
          raw: 20,
          explanation:
            'Only unconfirmed context — a possible path awaiting confirmation.',
        };
      }
      return { raw: 0, explanation: 'No known path to anyone at this account.' };
    }
    case 'timing_signals': {
      const signals = claims.filter((claim) => claim.kind === 'signal');
      if (signals.length === 0) {
        return { raw: 0, explanation: 'No recent buying signals recorded.' };
      }
      return {
        raw: Math.min(100, signals.length * 50),
        explanation: `${signals.length} recorded signal${signals.length === 1 ? '' : 's'}.`,
      };
    }
    case 'evidence_confidence': {
      const hosts = distinctHosts([...identity, ...fit]);
      const raw = hosts >= 3 ? 100 : hosts === 2 ? 70 : hosts === 1 ? 40 : 0;
      return {
        raw,
        explanation: `${hosts} independent publisher${hosts === 1 ? '' : 's'} behind identity and fit.`,
      };
    }
    case 'data_freshness': {
      if (claims.length === 0) {
        return {
          raw: 0,
          explanation: 'No evidence to be fresh.',
          missing: true,
          missingInputs: ['any evidence'],
        };
      }
      const newest = Math.max(
        ...claims.map((claim) => new Date(claim.retrievedAt).getTime()),
      );
      const ageDays = Math.floor((inputs.now.getTime() - newest) / 86_400_000);
      const raw = ageDays <= 30 ? 100 : ageDays <= 90 ? 70 : ageDays <= 180 ? 40 : 10;
      return {
        raw,
        explanation: `The newest evidence is ${ageDays} day${ageDays === 1 ? '' : 's'} old.`,
      };
    }
  }
}

export function computeAccountScore(inputs: ScoringInputs): ComputedScore {
  const components: ScoreComponent[] = SCORE_DIMENSIONS.map((dimension) => {
    const weight = inputs.weights[dimension] ?? 0;
    const signal = signalFor(dimension, inputs);
    return {
      dimension,
      label: SCORE_DIMENSION_LABEL[dimension],
      raw: signal.raw,
      weight,
      weighted: signal.raw * weight,
      explanation: signal.explanation,
      missing: signal.missing ?? false,
      missingInputs: signal.missingInputs ?? [],
    };
  });

  const weightSum = components.reduce((sum, component) => sum + component.weight, 0);
  const weightedSum = components.reduce((sum, component) => sum + component.weighted, 0);
  const total = weightSum === 0 ? 0 : Math.round(weightedSum / weightSum);

  return {
    total,
    components,
    weightsUsed: { ...inputs.weights },
    computedAt: inputs.now.toISOString(),
  };
}
