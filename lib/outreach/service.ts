import 'server-only';
import { getLeadStore } from '@/lib/leads/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { getRelationshipStore } from '@/lib/relationships/store';
import { getCampaignStore } from '@/lib/campaigns/store';
import { getTeamStore } from '@/lib/team/store';
import { getOutreachStore, type DraftRecord } from '@/lib/outreach/store';
import { generateDraft } from '@/lib/outreach/generate';
import { matchBrands } from '@/lib/scoring/matching';
import { lintDraft, type LintViolation } from '@/lib/outreach/lint';
import { PlatformError } from '@/lib/errors';
import type { OutreachChannel } from '@/schemas/outreach';

/**
 * Draft orchestration: suppression first, evidence gathered, templates
 * assembled, every draft persisted with the references it used. The
 * linter runs on the freshly generated text too — a template bug that
 * fabricated a claim would refuse its own approval.
 */
export async function generateDraftsForAccount(input: {
  accountId: string;
  contactId: string | null;
  channels: OutreachChannel[];
  language: 'en' | 'ar';
  createdBy: string;
}): Promise<{ drafts: DraftRecord[]; skipped: { channel: string; reason: string }[] }> {
  const leads = await getLeadStore();
  const outreach = await getOutreachStore();

  const account = await leads.getAccount(input.accountId);
  if (!account || account.status === 'merged') {
    throw new PlatformError('NOT_FOUND', 'No such account');
  }

  // Suppression is checked before anything is assembled.
  if (await outreach.isSuppressed('account', input.accountId)) {
    throw new PlatformError(
      'INVALID_INPUT',
      'This account is on the do-not-contact list; no drafts can be generated for it.',
    );
  }
  const contact = input.contactId ? await leads.getContact(input.contactId) : null;
  if (input.contactId && !contact) {
    throw new PlatformError('NOT_FOUND', 'No such contact');
  }
  if (contact && (await outreach.isSuppressed('contact', contact.id))) {
    throw new PlatformError(
      'INVALID_INPUT',
      'This contact is on the do-not-contact list; no drafts can be generated for them.',
    );
  }

  const config = await getAltConfigStore();
  const relationships = await getRelationshipStore();
  const team = await getTeamStore();
  const campaigns = await getCampaignStore();

  const [claims, proofPoints, rules, brands] = await Promise.all([
    leads.listClaims(input.accountId),
    config.getConfig('proof_points'),
    config.getConfig('outreach_rules'),
    config.listBrands(),
  ]);
  const matches = brands.length > 0 ? matchBrands(account, claims, brands) : [];
  const edges = contact ? await relationships.forContact(contact.id) : [];

  // The colleague a warm intro request would go to, named by the edge.
  const warmEdge = edges.find((edge) => edge.confirmedBy);
  const colleague = warmEdge ? await team.get(warmEdge.employeeId) : null;

  const campaign = account.campaignId ? await campaigns.get(account.campaignId) : null;

  const drafts: DraftRecord[] = [];
  const skipped: { channel: string; reason: string }[] = [];

  for (const channel of input.channels) {
    const generated = generateDraft(channel, input.language, {
      account,
      contact: contact
        ? { id: contact.id, fullName: contact.fullName, roleTitle: contact.roleTitle }
        : null,
      claims,
      proofPoints: proofPoints.map((point) => ({
        text: point.text,
        source: point.source,
      })),
      matches,
      relationships: edges,
      objective: campaign?.objective ?? '',
      rules,
      colleagueName: colleague?.displayName ?? null,
    });
    if (!generated) {
      skipped.push({
        channel,
        reason:
          channel === 'intro_request'
            ? 'No confirmed warm path exists for this contact, so there is nobody to honestly ask for an introduction.'
            : 'Not enough grounded material for this channel.',
      });
      continue;
    }
    drafts.push(
      await outreach.createDraft({
        accountId: input.accountId,
        contactId: contact?.id ?? null,
        createdBy: input.createdBy,
        channel,
        language: input.language,
        body: generated.body,
        evidenceRefs: generated.evidenceRefs,
      }),
    );
  }

  return { drafts, skipped };
}

/** Lint a draft against its own evidence and the prohibited-claims list. */
export async function lintDraftRecord(draft: DraftRecord): Promise<LintViolation[]> {
  const config = await getAltConfigStore();
  const prohibited = await config.getConfig('prohibited_claims');
  return lintDraft(draft.body, draft.evidenceRefs, prohibited);
}
