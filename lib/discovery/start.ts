import 'server-only';
import { getCampaignStore, type CampaignRunRecord } from '@/lib/campaigns/store';
import { getIcpStore } from '@/lib/icps/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import {
  buildDiscoveryPlan,
  estimateCost,
  type CostEstimate,
} from '@/lib/discovery/plan';
import { PlatformError } from '@/lib/errors';
import { getEnv } from '@/lib/env';
import { logger } from '@/lib/observability/logger';

/**
 * Starting a campaign: preview first, budget caps enforced, exactly one
 * active run.
 *
 * The preview a manager confirms is computed by the same pure functions
 * the engine plans with, so the number on the confirmation dialog is the
 * ceiling the run can spend. Two caps gate the start server-side, whatever
 * the client claimed: the per-campaign cap from configuration, and the
 * workspace-wide daily cap measured against runs actually created today.
 */

export interface CampaignPreview {
  estimate: CostEstimate;
  perCampaignCap: number;
  perDayCap: number;
  spentToday: number;
  /** Whether starting now would be allowed. */
  startable: boolean;
  /** Why not, in words, when it would not be. */
  blockedReason: string | null;
}

function startOfTodayUtc(): string {
  return `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
}

export async function previewCampaign(campaignId: string): Promise<CampaignPreview> {
  const campaigns = await getCampaignStore();
  const icps = await getIcpStore();
  const config = await getAltConfigStore();

  const campaign = await campaigns.get(campaignId);
  if (!campaign) throw new PlatformError('NOT_FOUND', 'No such campaign');
  const icp = campaign.icpId ? await icps.get(campaign.icpId) : null;
  if (!icp) throw new PlatformError('NOT_FOUND', 'The campaign has no profile');

  const [territories, caps, spentToday] = await Promise.all([
    config.listTerritories(),
    config.getConfig('budget_caps'),
    campaigns.unitsSpentSince(startOfTodayUtc()),
  ]);

  const plan = buildDiscoveryPlan(campaign, icp, territories);
  const estimate = estimateCost(plan, campaign);

  let blockedReason: string | null = null;
  if (estimate.chargeableCeiling > caps.perCampaignUnits) {
    blockedReason = `The campaign budget (${estimate.chargeableCeiling} units) exceeds the per-campaign cap of ${caps.perCampaignUnits}.`;
  } else if (spentToday + estimate.chargeableCeiling > caps.perDayUnits) {
    blockedReason = `Today's research has already used ${spentToday} of ${caps.perDayUnits} units; this run's ceiling of ${estimate.chargeableCeiling} will not fit.`;
  }

  return {
    estimate,
    perCampaignCap: caps.perCampaignUnits,
    perDayCap: caps.perDayUnits,
    spentToday,
    startable: blockedReason === null,
    blockedReason,
  };
}

export interface StartResult {
  run: CampaignRunRecord;
  duplicate: boolean;
}

export async function startCampaign(
  campaignId: string,
  startedBy: string,
): Promise<StartResult> {
  const campaigns = await getCampaignStore();
  const campaign = await campaigns.get(campaignId);
  if (!campaign) throw new PlatformError('NOT_FOUND', 'No such campaign');
  if (campaign.status === 'archived') {
    throw new PlatformError('INVALID_INPUT', 'An archived campaign cannot run.');
  }

  const preview = await previewCampaign(campaignId);
  if (!preview.startable) {
    throw new PlatformError('BUDGET_EXCEEDED', preview.blockedReason ?? undefined);
  }

  const { run, duplicate } = await campaigns.createRun(
    campaignId,
    startedBy,
    preview.estimate.chargeableCeiling,
  );
  if (duplicate) return { run, duplicate };

  await campaigns.setStatus(campaignId, 'running');
  logger.info('discovery.run_started', {
    campaignId,
    runId: run.id,
    unitsBudget: run.unitsBudget,
  });
  return { run, duplicate: false };
}

/** Stale-run repair: same stall window the report pipeline uses. */
export function runStallCutoffIso(now = new Date()): string {
  const minutes = getEnv().JOB_STALL_MINUTES;
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

export async function repairStalledCampaignRuns(): Promise<number> {
  const campaigns = await getCampaignStore();
  const stale = await campaigns.listStaleRuns(runStallCutoffIso());
  for (const run of stale) {
    // Re-read inside the loop: the sweep may race a run that just finished.
    const current = await campaigns.getRun(run.id);
    if (!current || !['queued', 'running'].includes(current.status)) continue;
    await campaigns.finishRun(run.id, 'failed', 'JOB_STALLED');
    await campaigns.setStatus(run.campaignId, 'failed');
    logger.warn('discovery.run_repaired', { runId: run.id, campaignId: run.campaignId });
  }
  return stale.length;
}
