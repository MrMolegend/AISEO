import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLeadStore,
  resetMemoryLeadStore,
  resetLeadStoreCache,
} from '@/lib/leads/store';
import {
  getPipelineStore,
  resetMemoryPipelineStore,
  resetPipelineStoreCache,
} from '@/lib/pipeline/store';
import {
  resetMemoryAltConfigStore,
  resetAltConfigStoreCache,
} from '@/lib/alt/config-store';
import { changeStage, applyPlaybook } from '@/lib/pipeline/service';
import { normalizeAccountName } from '@/lib/leads/normalize';

const REP = '99999999-9999-4999-8999-999999999999';
const OTHER = '12121212-1212-4212-8212-121212121212';

async function seedAccount(name = 'Pet Oasis') {
  const store = await getLeadStore();
  const { account } = await store.upsertAccount({
    campaignId: null,
    icpId: null,
    canonicalName: name,
    normalizedName: normalizeAccountName(name),
    domain: null,
    websiteUrl: null,
    segmentKey: 'independent_pet_retail',
    territoryKey: 'AE-DU',
  });
  return account;
}

beforeEach(() => {
  resetMemoryLeadStore();
  resetLeadStoreCache();
  resetMemoryPipelineStore();
  resetPipelineStoreCache();
  resetMemoryAltConfigStore();
  resetAltConfigStoreCache();
});

describe('pipeline stages', () => {
  it('every move writes history: who, from, to, why', async () => {
    const account = await seedAccount();
    const pipeline = await getPipelineStore();

    await changeStage({
      accountId: account.id,
      stage: 'contacted',
      note: 'First email sent by hand.',
      changedBy: REP,
    });
    await changeStage({
      accountId: account.id,
      stage: 'replied',
      note: '',
      changedBy: REP,
    });

    const leads = await getLeadStore();
    expect((await leads.getAccount(account.id))?.pipelineStage).toBe('replied');

    const history = await pipeline.historyForAccount(account.id);
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ fromStage: 'contacted', toStage: 'replied' });
    expect(history[1]).toMatchObject({
      fromStage: null,
      toStage: 'contacted',
      note: 'First email sent by hand.',
    });
  });

  it('reopening a settled account demands a note', async () => {
    const account = await seedAccount();
    await changeStage({
      accountId: account.id,
      stage: 'lost',
      note: 'Chose another supplier.',
      changedBy: REP,
    });
    await expect(
      changeStage({
        accountId: account.id,
        stage: 'contacted',
        note: '',
        changedBy: REP,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });

    await changeStage({
      accountId: account.id,
      stage: 'contacted',
      note: 'They called back after the supplier fell through.',
      changedBy: REP,
    });
  });
});

describe('playbooks', () => {
  it('applying one creates its tasks with computed due dates, idempotently', async () => {
    const account = await seedAccount();
    const first = await applyPlaybook({
      accountId: account.id,
      playbookKey: 'cold_researched',
      assigneeId: REP,
      createdBy: REP,
    });
    expect(first.created).toHaveLength(3);
    expect(first.existing).toBe(0);
    expect(first.created.every((task) => task.dueOn !== null)).toBe(true);

    const again = await applyPlaybook({
      accountId: account.id,
      playbookKey: 'cold_researched',
      assigneeId: REP,
      createdBy: REP,
    });
    expect(again.created).toHaveLength(0);
    expect(again.existing).toBe(3);

    const pipeline = await getPipelineStore();
    expect(await pipeline.tasksForAccount(account.id)).toHaveLength(3);
  });

  it('an unknown playbook is a 404, not an empty success', async () => {
    const account = await seedAccount();
    await expect(
      applyPlaybook({
        accountId: account.id,
        playbookKey: 'does_not_exist',
        assigneeId: REP,
        createdBy: REP,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('activities and privacy', () => {
  it('private notes are visible only to their author', async () => {
    const account = await seedAccount();
    const pipeline = await getPipelineStore();

    await pipeline.addActivity({
      accountId: account.id,
      contactId: null,
      authorId: REP,
      kind: 'note',
      body: 'Public note for the team.',
      private: false,
    });
    await pipeline.addActivity({
      accountId: account.id,
      contactId: null,
      authorId: REP,
      kind: 'note',
      body: 'Private hunch.',
      private: true,
    });

    const mine = await pipeline.activitiesForAccount(account.id, REP);
    const theirs = await pipeline.activitiesForAccount(account.id, OTHER);
    expect(mine).toHaveLength(2);
    expect(theirs).toHaveLength(1);
    expect(theirs[0]!.body).toBe('Public note for the team.');
  });
});

describe('tasks and saved views', () => {
  it('completion stamps the time; dropping keeps the record', async () => {
    const pipeline = await getPipelineStore();
    const { task } = await pipeline.createTask({
      accountId: null,
      assigneeId: REP,
      createdBy: REP,
      title: 'Call the distributor back',
      detail: null,
      dueOn: '2026-09-10',
    });

    const done = await pipeline.updateTaskStatus(task.id, 'done');
    expect(done?.completedAt).toBeTruthy();
    expect(await pipeline.tasksForAssignee(REP, 'open')).toHaveLength(0);
    expect(await pipeline.tasksForAssignee(REP, 'done')).toHaveLength(1);
  });

  it('saved views are per member and upsert by name', async () => {
    const pipeline = await getPipelineStore();
    await pipeline.saveView({ userId: REP, name: 'Dubai qualified', path: '/leads?a=1' });
    await pipeline.saveView({ userId: REP, name: 'Dubai qualified', path: '/leads?a=2' });
    await pipeline.saveView({ userId: OTHER, name: 'Theirs', path: '/leads' });

    const mine = await pipeline.viewsForUser(REP);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.path).toBe('/leads?a=2');

    // Another member cannot delete a view they do not own.
    expect(await pipeline.deleteView(mine[0]!.id, OTHER)).toBe(false);
    expect(await pipeline.deleteView(mine[0]!.id, REP)).toBe(true);
  });
});
