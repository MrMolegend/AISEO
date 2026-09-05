import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLeadStore,
  resetMemoryLeadStore,
  resetLeadStoreCache,
} from '@/lib/leads/store';
import {
  resetMemoryAltConfigStore,
  resetAltConfigStoreCache,
} from '@/lib/alt/config-store';
import { buildPreview, commitImport, undoImport } from '@/lib/imports/service';

/**
 * The import lifecycle against the store: idempotent commits and an undo
 * that reverses the import without touching a colleague's work.
 */

const CSV = [
  'name,segment,territory,website,notes',
  'Import One,independent_pet_retail,AE-DU,importone.example,From the fair',
  'Import Two,veterinary_retail,AE-AZ,,',
].join('\n');

beforeEach(() => {
  resetMemoryLeadStore();
  resetLeadStoreCache();
  resetMemoryAltConfigStore();
  resetAltConfigStoreCache();
});

describe('import lifecycle', () => {
  it('commit creates what the preview promised, and notes land as the summary', async () => {
    const preview = await buildPreview(CSV);
    expect(preview.creatable).toBe(2);

    const result = await commitImport(CSV);
    expect(result.created).toBe(2);
    expect(result.existed).toBe(0);

    const leads = await getLeadStore();
    const one = await leads.getAccount(result.createdIds[0]!);
    expect(one?.summary).toBe('From the fair');
    expect(one?.status).toBe('candidate');
  });

  it('committing the same file twice converges instead of duplicating', async () => {
    const first = await commitImport(CSV);
    const second = await commitImport(CSV);
    expect(first.created).toBe(2);
    expect(second.created).toBe(0);
    expect(second.existed).toBe(2);

    const leads = await getLeadStore();
    expect(await leads.countAccounts({})).toBe(2);
  });

  it('undo rejects untouched candidates and leaves worked accounts alone', async () => {
    const { createdIds } = await commitImport(CSV);
    const leads = await getLeadStore();

    // A colleague has started working the second account.
    await leads.updateAccount(createdIds[1]!, { pipelineStage: 'contacted' });

    const reverted = await undoImport(createdIds);
    expect(reverted).toBe(1);
    expect((await leads.getAccount(createdIds[0]!))?.status).toBe('rejected');
    expect((await leads.getAccount(createdIds[1]!))?.status).toBe('candidate');
  });
});
