import 'server-only';
import { getResearchProvider } from '@/lib/research';
import type { SearchResult } from '@/lib/research/provider';
import { getCampaignStore } from '@/lib/campaigns/store';
import { getLeadStore, type LeadStore } from '@/lib/leads/store';
import { getIcpStore, type IcpRecord } from '@/lib/icps/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { buildDiscoveryPlan } from '@/lib/discovery/plan';
import { candidateFromResult, isPlatformHost } from '@/lib/leads/normalize';
import { contactFromResult } from '@/lib/discovery/contacts';
import { recomputeAccountScore } from '@/lib/scoring/service';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';

/**
 * The discovery engine.
 *
 * Bounded, observable, resumable, and honest:
 *
 *   · One research unit = one provider search, decremented BEFORE the
 *     search runs; at zero the run finishes as 'partial', never overdrawn.
 *   · Every stage transition touches the run's heartbeat, so the stall
 *     sweep can tell a slow run from a dead one.
 *   · Retry never re-spends: accounts that already hold fit evidence skip
 *     enrichment, accounts that already hold contacts skip contact
 *     discovery, and candidate upserts deduplicate structurally.
 *   · Cancellation is checked between stages and between accounts.
 *   · Nothing is invented. An account exists because a source named it; a
 *     contact exists because a source published name, role and company in
 *     one structured title. Empty results produce silence and a truthful
 *     'research_needed' status, not filler.
 */

class BudgetExhausted extends Error {}
class Cancelled extends Error {}

interface EngineContext {
  runId: string;
  unitsSpent: number;
  unitsBudget: number;
  clipped: boolean;
}

function classifySourceCategory(url: string): string {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'public_search_index';
  }
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    return 'public_search_index';
  }
  if (isPlatformHost(url)) {
    return host.includes('yellowpages') || host.includes('directory')
      ? 'public_directory'
      : 'marketplace';
  }
  if (host.includes('news') || host.includes('press')) return 'news';
  if (host.includes('directory') || host.includes('yellowpages')) {
    return 'public_directory';
  }
  return 'company_website';
}

export async function runCampaignDiscovery(runId: string): Promise<void> {
  const campaigns = await getCampaignStore();
  const leads = await getLeadStore();
  const icps = await getIcpStore();
  const config = await getAltConfigStore();
  const provider = await getResearchProvider();

  const run = await campaigns.getRun(runId);
  if (!run) throw new PlatformError('NOT_FOUND', 'No such run');
  const campaign = await campaigns.get(run.campaignId);
  if (!campaign) throw new PlatformError('NOT_FOUND', 'No such campaign');
  const icp = campaign.icpId ? await icps.get(campaign.icpId) : null;
  if (!icp) {
    await campaigns.finishRun(runId, 'failed', 'INVALID_INPUT');
    await campaigns.setStatus(campaign.id, 'failed');
    return;
  }

  const context: EngineContext = {
    runId,
    unitsSpent: run.unitsSpent,
    unitsBudget: run.unitsBudget,
    clipped: false,
  };

  const abort = new AbortController();

  async function assertNotCancelled(): Promise<void> {
    const current = await campaigns.getRun(runId);
    if (current?.status === 'cancelled') throw new Cancelled();
  }

  async function spendAndSearch(
    query: string,
    area: string,
    maxResults: number,
  ): Promise<SearchResult[]> {
    if (context.unitsSpent >= context.unitsBudget) {
      context.clipped = true;
      throw new BudgetExhausted();
    }
    context.unitsSpent += 1;
    await campaigns.updateRun(runId, { unitsSpent: context.unitsSpent });
    const response = await provider.search({ query, area, maxResults }, abort.signal);
    return response.results;
  }

  const territories = await config.listTerritories();
  const plan = buildDiscoveryPlan(campaign, icp, territories);

  try {
    await campaigns.setRunStage(runId, 'planning');
    await assertNotCancelled();

    /* ── Candidate discovery ─────────────────────────────────────────── */
    await campaigns.setRunStage(runId, 'discovering_accounts');
    const collected: {
      result: SearchResult;
      segmentKey: string;
      territoryKey: string;
    }[] = [];
    try {
      for (const planned of plan.candidateQueries) {
        await assertNotCancelled();
        const results = await spendAndSearch(planned.query, planned.area, 10);
        for (const result of results) {
          collected.push({
            result,
            segmentKey: planned.segmentKey,
            territoryKey: planned.territoryKey,
          });
        }
      }
    } catch (error) {
      if (!(error instanceof BudgetExhausted)) throw error;
    }

    /* ── Normalisation and deduplication ─────────────────────────────── */
    await campaigns.setRunStage(runId, 'normalising_accounts');
    const accountIds: string[] = [];
    for (const { result, segmentKey, territoryKey } of collected) {
      const candidate = candidateFromResult(result);
      if (!candidate) continue;

      const { account, existed } = await leads.upsertAccount({
        campaignId: campaign.id,
        icpId: icp.id,
        canonicalName: candidate.name,
        normalizedName: candidate.normalizedName,
        domain: candidate.domain,
        websiteUrl: candidate.websiteUrl,
        segmentKey,
        territoryKey,
      });
      if (!accountIds.includes(account.id)) accountIds.push(account.id);

      // The identity claim: the source that named this business. Recorded
      // even on dedup hits — a second independent source strengthens
      // identity — but never duplicated for the same URL.
      const existingClaims = existed ? await leads.listClaims(account.id) : [];
      const alreadyCited = existingClaims.some(
        (claim) => claim.sourceUrl === candidate.sourceUrl,
      );
      if (!alreadyCited) {
        await leads.addClaim({
          accountId: account.id,
          kind: 'identity',
          text: candidate.sourceExcerpt.slice(0, 500) || candidate.sourceTitle,
          sourceUrl: candidate.sourceUrl,
          sourceTitle: candidate.sourceTitle,
          sourceCategory: classifySourceCategory(candidate.sourceUrl),
          retrievalMode: 'indexed',
          confidence: 'medium',
          contentDate: result.publishedDate,
        });
      }
    }
    await campaigns.updateRun(runId, { accountsFound: accountIds.length });

    const workingSet = accountIds.slice(0, campaign.maxAccounts);

    /* ── Fit evidence ────────────────────────────────────────────────── */
    await campaigns.setRunStage(runId, 'enriching_accounts');
    try {
      for (const accountId of workingSet) {
        await assertNotCancelled();
        const account = await leads.getAccount(accountId);
        if (!account) continue;
        const claims = await leads.listClaims(accountId);
        // Retry-idempotency: evidence already gathered is never re-bought.
        if (claims.some((claim) => claim.kind === 'fit')) continue;

        const results = await spendAndSearch(
          `${account.canonicalName} products brands stocked`,
          `discovery:fit:${account.normalizedName}`,
          5,
        );
        for (const result of results.slice(0, 3)) {
          await leads.addClaim({
            accountId,
            kind: 'fit',
            text: result.excerpt.slice(0, 500) || result.title,
            sourceUrl: result.url,
            sourceTitle: result.title,
            sourceCategory: classifySourceCategory(result.url),
            retrievalMode: 'indexed',
            confidence: 'medium',
            contentDate: result.publishedDate,
          });
        }
      }
    } catch (error) {
      if (!(error instanceof BudgetExhausted)) throw error;
    }

    /* ── Decision-maker discovery ────────────────────────────────────── */
    await campaigns.setRunStage(runId, 'discovering_contacts');
    let contactsFound = 0;
    if (plan.contactSearchesPerAccount > 0) {
      try {
        for (const accountId of workingSet) {
          await assertNotCancelled();
          const account = await leads.getAccount(accountId);
          if (!account) continue;
          if ((await leads.countContacts(accountId)) > 0) continue;

          const results = await spendAndSearch(
            `${account.canonicalName} purchasing manager owner buyer`,
            `discovery:contacts:${account.normalizedName}`,
            5,
          );
          let added = 0;
          for (const result of results) {
            if (added >= campaign.maxContactsPerAccount) break;
            const extracted = contactFromResult(result, account.normalizedName);
            if (!extracted) continue;
            await leads.addContact({
              accountId,
              fullName: extracted.fullName,
              roleTitle: extracted.roleTitle,
              profileUrl: extracted.profileUrl,
              companyBioUrl: extracted.profileUrl ? null : extracted.sourceUrl,
              contactChannel: null,
              sourceUrl: extracted.sourceUrl,
              sourceCategory: classifySourceCategory(extracted.sourceUrl),
              employmentConfidence: 'unverified',
              lastVerifiedOn: null,
              roleRelevance: extracted.roleRelevance,
            });
            await leads.addClaim({
              accountId,
              kind: 'contact',
              text: `${extracted.fullName} appears as ${extracted.roleTitle} in an indexed public snippet.`,
              sourceUrl: extracted.sourceUrl,
              sourceTitle: extracted.sourceTitle,
              sourceCategory: classifySourceCategory(extracted.sourceUrl),
              retrievalMode: 'indexed',
              confidence: 'low',
              contentDate: null,
            });
            added += 1;
            contactsFound += 1;
          }
        }
      } catch (error) {
        if (!(error instanceof BudgetExhausted)) throw error;
      }
    }
    await campaigns.updateRun(runId, { contactsFound });

    /* ── Relationships ───────────────────────────────────────────────── */
    // Reads confirmed attestations only; nothing here spends or invents.
    // Until colleagues confirm edges (the relationship layer), this stage
    // truthfully records nothing.
    await campaigns.setRunStage(runId, 'resolving_relationships');
    await assertNotCancelled();

    /* ── Quality gate ────────────────────────────────────────────────── */
    await campaigns.setRunStage(runId, 'quality_review');
    let qualified = 0;
    for (const accountId of workingSet) {
      const verdict = await applyQualityGate(leads, accountId, icp);
      if (verdict === 'qualified') qualified += 1;
      // The explainable score, from the same rows the gate just read.
      // Deterministic and free; a failure here is logged, not fatal.
      await recomputeAccountScore(accountId).catch((error) => {
        logger.warn('discovery.score_failed', {
          accountId,
          error: error instanceof Error ? error.message : 'unknown',
        });
      });
    }
    await campaigns.updateRun(runId, { accountsQualified: qualified });

    const finalStatus = context.clipped ? 'partial' : 'completed';
    await campaigns.finishRun(runId, finalStatus);
    await campaigns.setStatus(campaign.id, finalStatus);
    logger.info('discovery.run_finished', {
      runId,
      campaignId: campaign.id,
      status: finalStatus,
      unitsSpent: context.unitsSpent,
      accountsFound: accountIds.length,
      accountsQualified: qualified,
      contactsFound,
    });
  } catch (error) {
    if (error instanceof Cancelled) {
      await campaigns.finishRun(runId, 'cancelled');
      await campaigns.setStatus(campaign.id, 'cancelled');
      return;
    }
    const code = error instanceof PlatformError ? error.code : 'UNKNOWN';
    await campaigns.finishRun(runId, 'failed', code);
    await campaigns.setStatus(campaign.id, 'failed');
    logger.error('discovery.run_failed', { runId, campaignId: campaign.id, code });
  }
}

/**
 * The evidence gate, per the ICP's bar. Explainable and deterministic:
 *
 *   minimal   ≥ 1 identity claim
 *   standard  ≥ 1 identity claim and ≥ 1 fit claim
 *   strict    ≥ 1 identity claim and ≥ 2 fit claims from distinct hosts
 *
 * Failures park the account as research_needed — never presented as
 * sales-ready, never deleted.
 */
export async function applyQualityGate(
  leads: LeadStore,
  accountId: string,
  icp: Pick<IcpRecord, 'minEvidenceLevel'>,
): Promise<'qualified' | 'research_needed'> {
  const claims = await leads.listClaims(accountId);
  const identity = claims.filter((claim) => claim.kind === 'identity');
  const fit = claims.filter((claim) => claim.kind === 'fit');

  const fitHosts = new Set(
    fit.map((claim) => {
      try {
        return new URL(claim.sourceUrl).hostname;
      } catch {
        return claim.sourceUrl;
      }
    }),
  );

  let passes = false;
  switch (icp.minEvidenceLevel) {
    case 'minimal':
      passes = identity.length >= 1;
      break;
    case 'standard':
      passes = identity.length >= 1 && fit.length >= 1;
      break;
    case 'strict':
      passes = identity.length >= 1 && fitHosts.size >= 2;
      break;
  }

  const status = passes ? 'qualified' : 'research_needed';
  const rationale = passes
    ? `Identity supported by ${identity.length} source${identity.length === 1 ? '' : 's'}; fit supported by ${fit.length} source${fit.length === 1 ? '' : 's'} across ${fitHosts.size} publisher${fitHosts.size === 1 ? '' : 's'}.`
    : `Evidence below the '${icp.minEvidenceLevel}' bar: ${identity.length} identity source${identity.length === 1 ? '' : 's'}, ${fit.length} fit source${fit.length === 1 ? '' : 's'}. Needs more research before outreach.`;

  await leads.updateAccount(accountId, { status, fitRationale: rationale });
  return status;
}
