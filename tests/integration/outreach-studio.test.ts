import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLeadStore,
  resetMemoryLeadStore,
  resetLeadStoreCache,
} from '@/lib/leads/store';
import {
  getOutreachStore,
  resetMemoryOutreachStore,
  resetOutreachStoreCache,
} from '@/lib/outreach/store';
import {
  getRelationshipStore,
  resetMemoryRelationshipStore,
  resetRelationshipStoreCache,
} from '@/lib/relationships/store';
import {
  getTeamStore,
  resetMemoryTeamStore,
  resetTeamStoreCache,
} from '@/lib/team/store';
import {
  resetMemoryAltConfigStore,
  resetAltConfigStoreCache,
  getAltConfigStore,
} from '@/lib/alt/config-store';
import { generateDraftsForAccount, lintDraftRecord } from '@/lib/outreach/service';
import { lintDraft } from '@/lib/outreach/lint';
import { normalizeAccountName } from '@/lib/leads/normalize';

const REP = '99999999-9999-4999-8999-999999999999';
const COLLEAGUE = '10101010-1010-4010-8010-101010101010';

async function seedWorld() {
  const leads = await getLeadStore();
  const { account } = await leads.upsertAccount({
    campaignId: null,
    icpId: null,
    canonicalName: 'Pet Oasis Trading',
    normalizedName: normalizeAccountName('Pet Oasis Trading'),
    domain: 'petoasis.example',
    websiteUrl: 'https://petoasis.example/',
    segmentKey: 'independent_pet_retail',
    territoryKey: 'AE-DU',
  });
  await leads.addClaim({
    accountId: account.id,
    kind: 'fit',
    text: 'Premium dog and cat nutrition lines across two Jumeirah stores.',
    sourceUrl: 'https://petoasis.example/brands',
    sourceTitle: 'Brands we carry',
    sourceCategory: 'company_website',
    retrievalMode: 'indexed',
    confidence: 'medium',
    contentDate: null,
  });
  const contact = await leads.addContact({
    accountId: account.id,
    fullName: 'Fatima Hassan',
    roleTitle: 'Purchasing Manager',
    profileUrl: 'https://www.linkedin.com/in/fatima-fixture',
    companyBioUrl: null,
    contactChannel: null,
    sourceUrl: 'https://www.linkedin.com/in/fatima-fixture',
    sourceCategory: 'public_search_index',
    employmentConfidence: 'unverified',
    lastVerifiedOn: null,
    roleRelevance: 'Purchasing responsibility.',
  });
  return { account, contact };
}

beforeEach(() => {
  resetMemoryLeadStore();
  resetLeadStoreCache();
  resetMemoryOutreachStore();
  resetOutreachStoreCache();
  resetMemoryRelationshipStore();
  resetRelationshipStoreCache();
  resetMemoryTeamStore();
  resetTeamStoreCache();
  resetMemoryAltConfigStore();
  resetAltConfigStoreCache();
});

describe('draft generation', () => {
  it('grounds every draft in stored evidence, and the linter agrees', async () => {
    const { account, contact } = await seedWorld();
    const { drafts } = await generateDraftsForAccount({
      accountId: account.id,
      contactId: contact.id,
      channels: ['email_short', 'linkedin_note', 'call_opener'],
      language: 'en',
      createdBy: REP,
    });

    expect(drafts).toHaveLength(3);
    for (const draft of drafts) {
      expect(draft.status).toBe('draft');
      expect(draft.body).toContain('Arab Land Trading');
      expect(await lintDraftRecord(draft)).toEqual([]);
    }
    const email = drafts.find((draft) => draft.channel === 'email_short')!;
    expect(email.body).toContain('Fatima Hassan');
    expect(email.evidenceRefs.length).toBeGreaterThan(0);
  });

  it('skips the warm-introduction request when no honest path exists, and writes it when one does', async () => {
    const { account, contact } = await seedWorld();

    const withoutPath = await generateDraftsForAccount({
      accountId: account.id,
      contactId: contact.id,
      channels: ['intro_request'],
      language: 'en',
      createdBy: REP,
    });
    expect(withoutPath.drafts).toHaveLength(0);
    expect(withoutPath.skipped[0]!.reason).toContain('warm path');

    // A colleague confirms knowing the contact.
    const team = await getTeamStore();
    await team.upsert(
      { userId: COLLEAGUE, role: 'sales_rep', displayName: 'Amira', territories: [] },
      null,
    );
    const relationships = await getRelationshipStore();
    await relationships.upsert({
      employeeId: COLLEAGUE,
      contactId: contact.id,
      state: 'employee_confirmed_direct',
      provenance: 'employee_confirmation:Amira:2026-09-04',
      confirmedBy: COLLEAGUE,
    });

    const withPath = await generateDraftsForAccount({
      accountId: account.id,
      contactId: contact.id,
      channels: ['intro_request'],
      language: 'en',
      createdBy: REP,
    });
    expect(withPath.drafts).toHaveLength(1);
    const intro = withPath.drafts[0]!;
    expect(intro.body).toContain('Amira');
    expect(intro.body).toContain('you confirmed this yourself');
    expect(intro.evidenceRefs.some((ref) => ref.kind === 'relationship')).toBe(true);
  });

  it('produces a right-to-left Arabic variant', async () => {
    const { account, contact } = await seedWorld();
    const { drafts } = await generateDraftsForAccount({
      accountId: account.id,
      contactId: contact.id,
      channels: ['email_short'],
      language: 'ar',
      createdBy: REP,
    });
    expect(drafts[0]!.language).toBe('ar');
    // Arabic script present, and the greeting addresses the contact.
    expect(drafts[0]!.body).toMatch(/[؀-ۿ]/);
    expect(drafts[0]!.body).toContain('Fatima Hassan');
  });

  it('suppression blocks generation absolutely, for accounts and contacts', async () => {
    const { account, contact } = await seedWorld();
    const outreach = await getOutreachStore();

    await outreach.addSuppression({
      kind: 'contact',
      value: contact.id,
      reason: 'Asked not to be contacted.',
      createdBy: REP,
    });
    await expect(
      generateDraftsForAccount({
        accountId: account.id,
        contactId: contact.id,
        channels: ['email_short'],
        language: 'en',
        createdBy: REP,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    await outreach.addSuppression({
      kind: 'account',
      value: account.id,
      reason: 'Existing exclusive arrangement.',
      createdBy: REP,
    });
    await expect(
      generateDraftsForAccount({
        accountId: account.id,
        contactId: null,
        channels: ['email_short'],
        language: 'en',
        createdBy: REP,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});

describe('the unsupported-claim detector', () => {
  it('flags fabricated familiarity, prohibited claims, and unsourced numbers', () => {
    const violations = lintDraft(
      'Great to meet you at the show! I saw your post about expansion. We supply 4500 stores with a 30% margin.',
      [{ kind: 'claim', id: 'c1', text: 'Premium nutrition lines in two stores.' }],
      [{ text: 'We supply 4500 stores' }],
    );
    const kinds = violations.map((violation) => violation.kind);
    expect(kinds).toContain('fabricated_familiarity');
    expect(kinds).toContain('prohibited_claim');
    expect(kinds).toContain('unsupported_number');
  });

  it('passes numbers the evidence actually holds, and years', () => {
    const violations = lintDraft(
      'Your two Jumeirah stores have carried premium lines since 2015.',
      [
        {
          kind: 'claim',
          id: 'c1',
          text: 'Premium dog and cat nutrition lines across two (2) Jumeirah stores. Established 2015.',
        },
      ],
      [],
    );
    expect(violations).toEqual([]);
  });
});

describe('the approval lifecycle', () => {
  it('edits create versions and reset approval; copying is recorded', async () => {
    const { account, contact } = await seedWorld();
    const outreach = await getOutreachStore();
    const { drafts } = await generateDraftsForAccount({
      accountId: account.id,
      contactId: contact.id,
      channels: ['email_short'],
      language: 'en',
      createdBy: REP,
    });
    const draft = drafts[0]!;

    await outreach.setStatus(draft.id, 'approved', REP);
    expect((await outreach.get(draft.id))?.status).toBe('approved');

    const edited = await outreach.updateBody(
      draft.id,
      `${draft.body}\n\nP.S. Our price list is attached.`,
      REP,
    );
    expect(edited?.status).toBe('draft');
    expect(edited?.approvedBy).toBeNull();
    expect(edited?.version).toBe(2);
    expect(await outreach.versions(draft.id)).toHaveLength(2);

    await outreach.setStatus(draft.id, 'approved', REP);
    await outreach.recordCopy(draft.id);
    expect((await outreach.get(draft.id))?.lastCopiedAt).toBeTruthy();
  });

  it('a template bug that fabricated a claim would refuse its own approval', async () => {
    const { account, contact } = await seedWorld();
    const config = await getAltConfigStore();
    await config.setConfig(
      'prohibited_claims',
      [{ text: 'wholesale pet-supplies distributor', reason: 'Test prohibition.' }],
      REP,
    );
    const { drafts } = await generateDraftsForAccount({
      accountId: account.id,
      contactId: contact.id,
      channels: ['email_short'],
      language: 'en',
      createdBy: REP,
    });
    const violations = await lintDraftRecord(drafts[0]!);
    expect(violations.some((violation) => violation.kind === 'prohibited_claim')).toBe(
      true,
    );
  });
});
