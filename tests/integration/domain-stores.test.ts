import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryBusinessProfileStore,
  resetMemoryProfileStore,
} from '@/lib/profiles/store';
import { MemoryResearchDraftStore, resetMemoryDraftStore } from '@/lib/drafts/store';
import { MemoryActionItemStore, resetMemoryActionStore } from '@/lib/actions/store';
import {
  MemoryReportScenarioStore,
  resetMemoryScenarioStore,
} from '@/lib/scenarios/store';
import {
  MemoryReportFeedbackStore,
  resetMemoryFeedbackStore,
} from '@/lib/feedback/store';
import {
  MemoryShareLinkStore,
  resetMemoryShareStore,
  shareIsLive,
} from '@/lib/share/store';
import { hashShareToken, looksLikeShareToken, digestsEqual } from '@/lib/share/tokens';
import { MemoryResearchJobStore, resetMemoryJobStore } from '@/lib/jobs/store';
import { businessProfileSchema } from '@/schemas/business-profile';
import { isPlatformError } from '@/lib/errors';

/**
 * The domain stores, exercised on their memory drivers.
 *
 * Every store enforces ownership inside its own queries, so the assertion that
 * matters everywhere is the same one: another user's id returns nothing,
 * changes nothing, deletes nothing. The Supabase drivers express the same
 * filters in SQL; these tests pin the contract both drivers implement.
 */

const USER = '11111111-1111-4111-8111-111111111111';
const INTRUDER = '22222222-2222-4222-8222-222222222222';

function profileInput(name = 'Maldon Salt Co') {
  return businessProfileSchema.parse({ name, offerings: ['Flaky sea salt'] });
}

beforeEach(() => {
  resetMemoryProfileStore();
  resetMemoryDraftStore();
  resetMemoryActionStore();
  resetMemoryScenarioStore();
  resetMemoryFeedbackStore();
  resetMemoryShareStore();
  resetMemoryJobStore();
});

describe('business profile store', () => {
  it('creates, lists, updates and archives for the owner', async () => {
    const store = new MemoryBusinessProfileStore();
    const created = await store.create(USER, profileInput());
    expect(created.name).toBe('Maldon Salt Co');
    expect(created.websiteUrl).toBeNull();

    const updated = await store.update(
      created.id,
      USER,
      businessProfileSchema.parse({
        name: 'Maldon Salt Company',
        websiteUrl: 'maldonsalt.example',
      }),
    );
    expect(updated?.name).toBe('Maldon Salt Company');
    // The lenient website entry is stored as a normalised absolute URL.
    expect(updated?.websiteUrl).toBe('https://maldonsalt.example/');

    expect(await store.setArchived(created.id, USER, true)).toBe(true);
    expect(await store.listForUser(USER)).toHaveLength(0);
    expect(await store.listForUser(USER, { includeArchived: true })).toHaveLength(1);
  });

  it('never returns, updates or archives another user’s profile', async () => {
    const store = new MemoryBusinessProfileStore();
    const created = await store.create(USER, profileInput());

    expect(await store.getForUser(created.id, INTRUDER)).toBeNull();
    expect(await store.update(created.id, INTRUDER, profileInput('Stolen'))).toBeNull();
    expect(await store.setArchived(created.id, INTRUDER, true)).toBe(false);
    expect(await store.listForUser(INTRUDER)).toHaveLength(0);

    // And the owner's copy is untouched by the attempts.
    const still = await store.getForUser(created.id, USER);
    expect(still?.name).toBe('Maldon Salt Co');
    expect(still?.archivedAt).toBeNull();
  });
});

describe('research draft store', () => {
  it('saves with compare-and-set and rejects the stale writer', async () => {
    const store = new MemoryResearchDraftStore();
    const draft = await store.create(USER, { businessName: 'Maldon' });
    expect(draft.revision).toBe(1);

    // Tab A saves against revision 1 and wins.
    const saved = await store.save(draft.id, USER, { businessName: 'Maldon Salt' }, 1);
    expect(saved.revision).toBe(2);

    // Tab B, still holding revision 1, loses loudly — not silently.
    await expect(
      store.save(draft.id, USER, { businessName: 'Old copy' }, 1),
    ).rejects.toSatisfy(
      (error: unknown) => isPlatformError(error) && error.code === 'DRAFT_CONFLICT',
    );

    // The winning write survived the losing attempt.
    const after = await store.getForUser(draft.id, USER);
    expect(after?.payload).toEqual({ businessName: 'Maldon Salt' });
  });

  it('freezes a draft at submission', async () => {
    const store = new MemoryResearchDraftStore();
    const draft = await store.create(USER, {});
    await store.markSubmitted(draft.id, USER, 'job-1');

    const submitted = await store.getForUser(draft.id, USER);
    expect(submitted?.status).toBe('submitted');
    expect(submitted?.submittedJobId).toBe('job-1');

    // A submitted draft takes no more writes, whatever revision is presented.
    await expect(store.save(draft.id, USER, { late: true }, 1)).rejects.toSatisfy(
      (error: unknown) => isPlatformError(error) && error.code === 'DRAFT_CONFLICT',
    );
    // And it no longer counts as the draft to resume.
    expect(await store.latestActive(USER)).toBeNull();
  });

  it('is invisible to other users', async () => {
    const store = new MemoryResearchDraftStore();
    const draft = await store.create(USER, { secret: 'launch plan' });

    expect(await store.getForUser(draft.id, INTRUDER)).toBeNull();
    expect(await store.latestActive(INTRUDER)).toBeNull();
    await expect(store.save(draft.id, INTRUDER, {}, 1)).rejects.toSatisfy(
      (error: unknown) => isPlatformError(error) && error.code === 'DRAFT_CONFLICT',
    );
    expect(await store.discard(draft.id, INTRUDER)).toBe(false);
  });
});

describe('action item store', () => {
  it('imports a recommendation exactly once, however often it is retried', async () => {
    const store = new MemoryActionItemStore();
    const first = await store.create(USER, {
      jobId: 'job-1',
      sourceActionId: 'register-food-business',
      title: 'Register as a food business',
      phase: 'days-1-30',
    });
    const retried = await store.create(USER, {
      jobId: 'job-1',
      sourceActionId: 'register-food-business',
      title: 'Register as a food business',
      phase: 'days-1-30',
    });

    expect(retried.id).toBe(first.id);
    expect(await store.listForUser(USER)).toHaveLength(1);

    // A different report importing the same action id is a different row —
    // idempotency is scoped to the report, not to the id string.
    const otherReport = await store.create(USER, {
      jobId: 'job-2',
      sourceActionId: 'register-food-business',
      title: 'Register as a food business',
      phase: 'days-1-30',
    });
    expect(otherReport.id).not.toBe(first.id);
  });

  it('tracks completion and enforces ownership on every verb', async () => {
    const store = new MemoryActionItemStore();
    const action = await store.create(USER, {
      title: 'Call the distributor',
      phase: 'later',
    });

    const done = await store.update(action.id, USER, { status: 'done' });
    expect(done?.completedAt).not.toBeNull();
    const reopened = await store.update(action.id, USER, { status: 'todo' });
    expect(reopened?.completedAt).toBeNull();

    expect(await store.getForUser(action.id, INTRUDER)).toBeNull();
    expect(await store.update(action.id, INTRUDER, { status: 'done' })).toBeNull();
    expect(await store.delete(action.id, INTRUDER)).toBe(false);
    expect(await store.delete(action.id, USER)).toBe(true);
  });
});

describe('scenario store', () => {
  it('upserts by name so a refined scenario stays one scenario', async () => {
    const store = new MemoryReportScenarioStore();
    await store.upsert(USER, 'job-1', 'Cautious', { budget: 500000 });
    const revised = await store.upsert(USER, 'job-1', 'Cautious', { budget: 750000 });

    const list = await store.listForJob(USER, 'job-1');
    expect(list).toHaveLength(1);
    expect(list[0]!.assumptions).toEqual({ budget: 750000 });
    expect(revised.createdAt).toBe(list[0]!.createdAt);

    expect(await store.listForJob(INTRUDER, 'job-1')).toHaveLength(0);
    expect(await store.delete(revised.id, INTRUDER)).toBe(false);
    expect(await store.delete(revised.id, USER)).toBe(true);
  });
});

describe('feedback store', () => {
  it('keeps one revisable verdict per user per report', async () => {
    const store = new MemoryReportFeedbackStore();
    await store.upsert(USER, 'job-1', {
      useful: false,
      category: 'depth',
      comment: 'Thin',
    });
    await store.upsert(USER, 'job-1', { useful: true, category: null, comment: null });
    await store.upsert(INTRUDER, 'job-1', {
      useful: false,
      category: 'other',
      comment: null,
    });

    const mine = await store.getForUser(USER, 'job-1');
    expect(mine?.useful).toBe(true);

    const aggregates = await store.aggregate();
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]).toMatchObject({
      jobId: 'job-1',
      usefulCount: 1,
      notUsefulCount: 1,
    });
  });
});

describe('share link store', () => {
  it('mints an unguessable token and stores only its hash', async () => {
    const store = new MemoryShareLinkStore();
    const { share, rawToken } = await store.create(USER, { jobId: 'job-1' });

    expect(looksLikeShareToken(rawToken)).toBe(true);
    // Nothing the store hands back ever contains the token or its hash.
    expect(JSON.stringify(share)).not.toContain(rawToken);
    expect(JSON.stringify(await store.listForUser(USER))).not.toContain(rawToken);

    const resolved = await store.resolve(rawToken, null);
    expect(resolved?.valid).toBe(true);
    expect(resolved?.share.useCount).toBe(1);

    expect(
      await store.resolve('not-a-real-token-aaaaaaaaaaaaaaaaaaaaaaaa', null),
    ).toBeNull();
  });

  it('revocation and expiry both close the door and are audited', async () => {
    const store = new MemoryShareLinkStore();
    const { share, rawToken } = await store.create(USER, { jobId: 'job-1' });

    expect(await store.revoke(share.id, INTRUDER)).toBe(false);
    expect(await store.revoke(share.id, USER)).toBe(true);

    const afterRevoke = await store.resolve(rawToken, 'ip-hash');
    expect(afterRevoke?.valid).toBe(false);

    const expired = await store.create(USER, { jobId: 'job-1', expiresInDays: 1 });
    expect(shareIsLive(expired.share, Date.now() + 2 * 24 * 60 * 60 * 1000)).toBe(false);

    const events = await store.recentEvents();
    const kinds = events.map((event) => event.event);
    expect(kinds).toContain('created');
    expect(kinds).toContain('revoked');
    expect(kinds).toContain('denied');
    // The audit trail records hashes and outcomes, never tokens.
    expect(JSON.stringify(events)).not.toContain(rawToken);
  });

  it('digest comparison is shape-strict', () => {
    const digest = hashShareToken('some-token');
    expect(digestsEqual(digest, digest)).toBe(true);
    expect(digestsEqual(digest, hashShareToken('other-token'))).toBe(false);
    expect(digestsEqual('', '')).toBe(false);
  });
});

describe('job store recovery surface', () => {
  it('finds stale non-terminal jobs by their last pulse', async () => {
    const store = new MemoryResearchJobStore();
    const job = await store.create({
      userId: USER,
      packageId: 'market-entry',
      tokenCost: 100,
      input: {} as never,
      inputHash: 'hash-1',
      subjectName: 'Maldon',
      subjectDomain: null,
    });

    // Fresh job, cutoff in the past: not stale.
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(await store.listStale(past)).toHaveLength(0);

    // Cutoff in the future: everything non-terminal is overdue.
    const future = new Date(Date.now() + 60_000).toISOString();
    expect((await store.listStale(future)).map((j) => j.id)).toContain(job.id);

    // A pulse updates the judgment...
    await store.touchHeartbeat(job.id);
    expect(await store.listStale(past)).toHaveLength(0);

    // ...and a terminal job is never stale, however old its pulse.
    await store.fail(job.id, 'JOB_STALLED');
    expect(await store.listStale(future)).toHaveLength(0);
  });

  it('surfaces a running duplicate for the same user and inputs only', async () => {
    const store = new MemoryResearchJobStore();
    const job = await store.create({
      userId: USER,
      packageId: 'market-entry',
      tokenCost: 100,
      input: {} as never,
      inputHash: 'hash-1',
      subjectName: 'Maldon',
      subjectDomain: null,
    });

    expect((await store.findActive(USER, 'hash-1'))?.id).toBe(job.id);
    expect(await store.findActive(INTRUDER, 'hash-1')).toBeNull();
    expect(await store.findActive(USER, 'hash-2')).toBeNull();

    await store.fail(job.id, 'JOB_TIMEOUT');
    expect(await store.findActive(USER, 'hash-1')).toBeNull();
  });
});
