import 'server-only';
import { getLeadStore } from '@/lib/leads/store';
import { getIcpStore } from '@/lib/icps/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { getRelationshipStore } from '@/lib/relationships/store';
import { getScoreStore, type ScoreRecord } from '@/lib/scoring/store';
import { computeAccountScore } from '@/lib/scoring/compute';
import { matchBrands, type ProductMatch } from '@/lib/scoring/matching';
import { PlatformError } from '@/lib/errors';

/**
 * Orchestration: gather one account's evidence, contacts, relationships,
 * the profile's constraints, the configured weights and the catalogue;
 * run the pure arithmetic; persist the result. Anyone reading the stored
 * score can re-derive it from the same rows.
 */
export async function recomputeAccountScore(accountId: string): Promise<{
  score: ScoreRecord;
  matches: ProductMatch[];
}> {
  const leads = await getLeadStore();
  const account = await leads.getAccount(accountId);
  if (!account) throw new PlatformError('NOT_FOUND', 'No such account');

  const icps = await getIcpStore();
  const icp = account.icpId ? await icps.get(account.icpId) : null;

  const config = await getAltConfigStore();
  const relationships = await getRelationshipStore();
  const scores = await getScoreStore();

  const [claims, contacts, weights, brands] = await Promise.all([
    leads.listClaims(accountId),
    leads.listContacts(accountId),
    config.getConfig('scoring_weights'),
    config.listBrands(),
  ]);

  const contactEdges = (
    await Promise.all(contacts.map((contact) => relationships.forContact(contact.id)))
  ).flat();

  const matches = brands.length > 0 ? matchBrands(account, claims, brands) : [];

  const computed = computeAccountScore({
    account,
    icp: icp ?? { segmentKeys: [], territoryKeys: [], criteria: null as never },
    claims,
    contacts,
    relationships: contactEdges,
    productMatches: brands.length > 0 ? matches : null,
    weights,
    now: new Date(),
  });

  const score = await scores.upsertComputed(accountId, computed);
  return { score, matches };
}
