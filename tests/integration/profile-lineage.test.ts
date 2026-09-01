import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createResearchJob } from '@/lib/jobs/create-job';
import { runResearchJob } from '@/lib/jobs/run-job';
import {
  getResearchJobStore,
  resetResearchJobStoreCache,
  resetMemoryJobStore,
} from '@/lib/jobs/store';
import { getTokenWallet, resetTokenWalletCache } from '@/lib/tokens';
import { resetMemoryWallet } from '@/lib/tokens/memory-wallet';
import { FixtureResearchProvider, resetResearchProviderCache } from '@/lib/research';
import { resetRateLimiter } from '@/lib/security/rate-limit';
import {
  getBusinessProfileStore,
  resetBusinessProfileStoreCache,
  resetMemoryProfileStore,
} from '@/lib/profiles/store';
import {
  getResearchDraftStore,
  resetResearchDraftStoreCache,
  resetMemoryDraftStore,
} from '@/lib/drafts/store';
import { businessProfileSchema } from '@/schemas/business-profile';
import { profileToBriefDefaults } from '@/lib/profiles/prefill';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';

/**
 * Profile lineage through the pipeline, on the memory drivers.
 *
 * Three promises under test: a brief seeded from a profile ties the finished
 * report to it (the version rail's raw material); a profile's optional
 * website joins the research as one best-effort seed whose unreachability can
 * not fail the report; and naming someone else's profile is refused before
 * anything is charged.
 */

const USER = '11111111-1111-4111-8111-111111111111';
const INTRUDER = '22222222-2222-4222-8222-222222222222';

let submissionCounter = 0;
function newSubmissionId(): string {
  submissionCounter += 1;
  return `lineage-${String(submissionCounter).padStart(6, '0')}`;
}

async function fund(userId: string, amount: number) {
  const wallet = await getTokenWallet();
  await wallet.bootstrap(userId, { welcomeTokens: 0 });
  await wallet.grant({
    userId,
    amount,
    type: 'admin_grant',
    idempotencyKey: `grant:lineage-${userId}-${submissionCounter}`,
    description: 'Test funding',
  });
}

beforeEach(() => {
  resetMemoryJobStore();
  resetMemoryWallet();
  resetMemoryProfileStore();
  resetMemoryDraftStore();
  resetResearchJobStoreCache();
  resetTokenWalletCache();
  resetBusinessProfileStoreCache();
  resetResearchDraftStoreCache();
  resetResearchProviderCache();
  resetRateLimiter();
  FixtureResearchProvider.reset();
});

afterEach(() => {
  FixtureResearchProvider.reset();
});

describe('a brief seeded from a profile', () => {
  it('ties the job to the profile and reads its website as one optional seed', async () => {
    await fund(USER, 500);

    const profiles = await getBusinessProfileStore();
    const profile = await profiles.create(
      USER,
      businessProfileSchema.parse({
        name: 'Ardmore Sea Salt',
        websiteUrl: 'ardmoresalt.example',
      }),
    );

    const created = await createResearchJob({
      userId: USER,
      body: { ...EXAMPLE_SUBMISSION, profileId: profile.id },
      submissionId: newSubmissionId(),
      ipHash: null,
    });
    expect(created.job.profileId).toBe(profile.id);

    // The reference rides beside the brief, never inside the stored snapshot.
    expect(
      (created.job.input as unknown as Record<string, unknown>).profileId,
    ).toBeUndefined();

    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);

    /*
     * The fixture transport has no page for the profile's website, so the
     * fetch fails — and that is the point: the report still completes, and
     * the site appears as evidence only in the weakest honest form. An
     * unreachable optional website costs nothing but itself.
     */
    expect(job?.status).toBe('complete');
    const site = job?.sources.find((source) =>
      source.url.includes('ardmoresalt.example'),
    );
    expect(site).toBeDefined();
    expect(site?.category).toBe('company');
    expect(site?.retrievalMode).toBe('indexed');

    // And the finished run is on the profile's version rail.
    expect((await store.listForProfile(USER, profile.id)).map((j) => j.id)).toContain(
      job!.id,
    );
  });

  it('completes identically when the profile has no website at all', async () => {
    await fund(USER, 500);

    const profiles = await getBusinessProfileStore();
    const profile = await profiles.create(
      USER,
      businessProfileSchema.parse({ name: 'Ardmore Sea Salt' }),
    );

    const created = await createResearchJob({
      userId: USER,
      body: { ...EXAMPLE_SUBMISSION, profileId: profile.id },
      submissionId: newSubmissionId(),
      ipHash: null,
    });
    await runResearchJob(created.job);

    const store = await getResearchJobStore();
    const job = await store.getForUser(created.job.publicId, USER);
    expect(job?.status).toBe('complete');
  });

  it('refuses someone else’s profile before anything is charged', async () => {
    await fund(USER, 500);
    await fund(INTRUDER, 500);

    const profiles = await getBusinessProfileStore();
    const theirs = await profiles.create(
      INTRUDER,
      businessProfileSchema.parse({ name: 'Their Business' }),
    );

    await expect(
      createResearchJob({
        userId: USER,
        body: { ...EXAMPLE_SUBMISSION, profileId: theirs.id },
        submissionId: newSubmissionId(),
        ipHash: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    // Nothing moved and nothing was created.
    const wallet = await getTokenWallet();
    expect(await wallet.getBalance(USER)).toEqual({ available: 500, reserved: 0 });
    const store = await getResearchJobStore();
    expect(await store.listForUser(USER, 10)).toHaveLength(0);
  });
});

describe('a brief grown from a draft', () => {
  it('freezes the draft as submitted, pointing at the job it became', async () => {
    await fund(USER, 500);

    const drafts = await getResearchDraftStore();
    const draft = await drafts.create(USER, { businessName: 'Ardmore' });

    const created = await createResearchJob({
      userId: USER,
      body: { ...EXAMPLE_SUBMISSION, draftId: draft.id },
      submissionId: newSubmissionId(),
      ipHash: null,
    });

    const frozen = await drafts.getForUser(draft.id, USER);
    expect(frozen?.status).toBe('submitted');
    expect(frozen?.submittedJobId).toBe(created.job.id);
  });

  it('ignores a foreign draft id without failing the submission', async () => {
    await fund(USER, 500);
    const drafts = await getResearchDraftStore();
    const theirs = await drafts.create(INTRUDER, {});

    const created = await createResearchJob({
      userId: USER,
      body: { ...EXAMPLE_SUBMISSION, draftId: theirs.id },
      submissionId: newSubmissionId(),
      ipHash: null,
    });
    expect(created.job.id).toBeTruthy();

    // Their draft is untouched.
    const still = await drafts.getForUser(theirs.id, INTRUDER);
    expect(still?.status).toBe('active');
  });
});

describe('profile → brief prefill', () => {
  it('copies only fields whose meaning is identical, and never a website', () => {
    const profiles = businessProfileSchema.parse({
      name: 'Ardmore Sea Salt',
      websiteUrl: 'ardmoresalt.example',
      description: 'Hand-harvested flaky sea salt from the Copper Coast.',
      homeCountry: 'IE',
      industry: 'Speciality food',
      offerings: ['Flaky sea salt', 'Smoked salt'],
      differentiators: ['Hand-harvested', 'Protected coastline'],
      knownCompetitors: ['Maldon'],
      tractionStage: 'trading',
      customerEvidence: 'A Dubai chef bought 40kg at a trade show.',
    });

    const defaults = profileToBriefDefaults({
      ...profiles,
      id: 'p-1',
      userId: USER,
      archivedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    });

    expect(defaults).toMatchObject({
      businessName: 'Ardmore Sea Salt',
      offerDescription: 'Hand-harvested flaky sea salt from the Copper Coast.',
      category: 'Speciality food',
      originCountry: 'IE',
      businessStatus: 'trading',
      productName: 'Flaky sea salt, Smoked salt',
      knownCompetitors: ['Maldon'],
    });

    // No URL-shaped value sneaks into the brief through the prefill.
    expect(JSON.stringify(defaults)).not.toContain('ardmoresalt.example');
  });
});
