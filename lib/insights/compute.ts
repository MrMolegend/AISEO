import { PIPELINE_STAGES, TERMINAL_STAGES, type PipelineStage } from '@/schemas/pipeline';

/**
 * Outcome analytics, computed from recorded results only.
 *
 * Pure functions over accounts and pipeline history: no store access, no
 * clock, no randomness — the same inputs always produce the same numbers,
 * and every rate carries the sample it was computed from. A rate whose
 * sample is below MIN_SAMPLE is flagged insufficient rather than charted:
 * two accounts do not make a conversion truth, whatever the percentage
 * arithmetic says.
 */

/** Below this sample size a rate is reported as "not enough data". */
export const MIN_SAMPLE = 5;

export interface InsightAccount {
  id: string;
  segmentKey: string | null;
  territoryKey: string | null;
  pipelineStage: string | null;
}

export interface InsightStageChange {
  accountId: string;
  toStage: string;
}

export interface StageCount {
  stage: PipelineStage;
  count: number;
}

export interface RateByGroup {
  /** Segment or territory key the rate belongs to. */
  key: string;
  /** How many accounts the denominator counts. */
  n: number;
  numerator: number;
  /** Percentage 0–100, integer; null when the sample is insufficient. */
  ratePct: number | null;
  insufficient: boolean;
}

function rate(
  numerator: number,
  n: number,
): Pick<RateByGroup, 'ratePct' | 'insufficient'> {
  if (n < MIN_SAMPLE) return { ratePct: null, insufficient: true };
  return { ratePct: Math.round((numerator / n) * 100), insufficient: false };
}

/** Accounts per pipeline stage, in stage order; stages with none included. */
export function stageFunnel(accounts: InsightAccount[]): StageCount[] {
  const counts = new Map<string, number>();
  for (const account of accounts) {
    if (!account.pipelineStage) continue;
    counts.set(account.pipelineStage, (counts.get(account.pipelineStage) ?? 0) + 1);
  }
  return PIPELINE_STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
}

/**
 * Contacted → replied, per group. Reached-stage facts come from history
 * rows, not the current stage, so an account that was contacted and later
 * lost still counts in the denominator it belongs to.
 */
export function replyRateBy(
  groupOf: (account: InsightAccount) => string | null,
  accounts: InsightAccount[],
  history: InsightStageChange[],
): RateByGroup[] {
  const reached = new Map<string, Set<string>>();
  for (const change of history) {
    if (!reached.has(change.accountId)) reached.set(change.accountId, new Set());
    reached.get(change.accountId)!.add(change.toStage);
  }

  const groups = new Map<string, { n: number; numerator: number }>();
  for (const account of accounts) {
    const key = groupOf(account);
    const stages = reached.get(account.id);
    if (!key || !stages?.has('contacted')) continue;
    const bucket = groups.get(key) ?? { n: 0, numerator: 0 };
    bucket.n += 1;
    if (stages.has('replied')) bucket.numerator += 1;
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([key, bucket]) => ({ key, ...bucket, ...rate(bucket.numerator, bucket.n) }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/**
 * Won share of settled accounts, per group, from current terminal stages.
 * Only settled accounts (won, lost, disqualified) enter the denominator.
 */
export function winRateBy(
  groupOf: (account: InsightAccount) => string | null,
  accounts: InsightAccount[],
): RateByGroup[] {
  const groups = new Map<string, { n: number; numerator: number }>();
  for (const account of accounts) {
    const key = groupOf(account);
    if (!key || !account.pipelineStage) continue;
    if (!TERMINAL_STAGES.includes(account.pipelineStage as PipelineStage)) continue;
    const bucket = groups.get(key) ?? { n: 0, numerator: 0 };
    bucket.n += 1;
    if (account.pipelineStage === 'customer_won') bucket.numerator += 1;
    groups.set(key, bucket);
  }

  return [...groups.entries()]
    .map(([key, bucket]) => ({ key, ...bucket, ...rate(bucket.numerator, bucket.n) }))
    .sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

export interface TerritoryRollup {
  key: string;
  name: string;
  kind: string;
  parentKey: string | null;
  accounts: number;
  /** Accounts in a live (non-terminal) pipeline stage. */
  inPipeline: number;
  won: number;
}

/** Per-territory counts, in the order the territories were given. */
export function territoryRollup(
  territories: { key: string; name: string; kind: string; parentKey: string | null }[],
  accounts: InsightAccount[],
): TerritoryRollup[] {
  return territories.map((territory) => {
    const here = accounts.filter((account) => account.territoryKey === territory.key);
    return {
      key: territory.key,
      name: territory.name,
      kind: territory.kind,
      parentKey: territory.parentKey,
      accounts: here.length,
      inPipeline: here.filter(
        (account) =>
          account.pipelineStage &&
          !TERMINAL_STAGES.includes(account.pipelineStage as PipelineStage),
      ).length,
      won: here.filter((account) => account.pipelineStage === 'customer_won').length,
    };
  });
}
