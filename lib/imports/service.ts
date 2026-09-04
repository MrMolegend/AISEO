import 'server-only';
import { getLeadStore } from '@/lib/leads/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { previewImport, type ImportPreview } from '@/lib/imports/parse';
import { DEFAULT_SEGMENTS } from '@/config/alt';

/**
 * Import orchestration: the preview a manager reads and the commit that
 * follows are the SAME computation over the same pasted text — the commit
 * re-runs the preview server-side and acts only on rows the preview would
 * have marked creatable, so a stale or tampered client cannot smuggle in
 * rows the preview never showed.
 *
 * Committing is idempotent by construction: creation goes through the
 * store's dedup-aware upsert, so pasting the same file twice converges on
 * the first import instead of duplicating it.
 */

export async function buildPreview(text: string): Promise<ImportPreview> {
  const [leads, config] = await Promise.all([getLeadStore(), getAltConfigStore()]);
  const [territories, existing] = await Promise.all([
    config.listTerritories(),
    leads.listAccounts({ limit: 1000 }),
  ]);

  const active = existing.filter((account) => account.status !== 'merged');
  return previewImport(text, {
    segmentKeys: DEFAULT_SEGMENTS.map((segment) => segment.key),
    territoryKeys: territories.map((territory) => territory.key),
    existingNames: new Set(active.map((account) => account.normalizedName)),
    existingDomains: new Set(
      active
        .map((account) => account.domain)
        .filter((domain): domain is string => domain !== null),
    ),
  });
}

export interface CommitResult {
  createdIds: string[];
  created: number;
  existed: number;
  skipped: number;
}

export async function commitImport(text: string): Promise<CommitResult> {
  const preview = await buildPreview(text);
  const leads = await getLeadStore();

  const createdIds: string[] = [];
  let existed = 0;
  let skipped = 0;

  for (const row of preview.rows) {
    if (row.error) {
      skipped += 1;
      continue;
    }
    const { account, existed: alreadyThere } = await leads.upsertAccount({
      campaignId: null,
      icpId: null,
      canonicalName: row.name,
      normalizedName: row.normalizedName,
      domain: row.domain,
      websiteUrl: row.websiteUrl,
      segmentKey: row.segmentKey,
      territoryKey: row.territoryKey,
    });
    if (alreadyThere) {
      existed += 1;
      continue;
    }
    createdIds.push(account.id);
    if (row.notes) {
      await leads.updateAccount(account.id, { summary: row.notes });
    }
  }

  return { createdIds, created: createdIds.length, existed, skipped };
}

/**
 * Undo: imported accounts that are still untouched candidates go to
 * 'rejected'. An account someone has already qualified, staged or worked
 * is left alone — undo reverses the import, not a colleague's judgement.
 */
export async function undoImport(accountIds: string[]): Promise<number> {
  const leads = await getLeadStore();
  let reverted = 0;
  for (const id of accountIds) {
    const account = await leads.getAccount(id);
    if (!account || account.status !== 'candidate' || account.pipelineStage) continue;
    await leads.updateAccount(id, { status: 'rejected' });
    reverted += 1;
  }
  return reverted;
}
