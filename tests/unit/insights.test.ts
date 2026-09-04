import { describe, it, expect } from 'vitest';
import {
  stageFunnel,
  replyRateBy,
  winRateBy,
  territoryRollup,
  MIN_SAMPLE,
  type InsightAccount,
} from '@/lib/insights/compute';

/**
 * Outcome analytics are pure arithmetic over recorded results, and every
 * rate carries its sample. The insufficiency rule is the point: a small
 * sample is reported as such, never charted as a percentage.
 */

function account(
  id: string,
  partial: Partial<Omit<InsightAccount, 'id'>> = {},
): InsightAccount {
  return {
    id,
    segmentKey: 'independent_pet_retail',
    territoryKey: 'AE-DU',
    pipelineStage: null,
    ...partial,
  };
}

describe('stage funnel', () => {
  it('counts accounts per stage in stage order, ignoring the unstaged', () => {
    const funnel = stageFunnel([
      account('a', { pipelineStage: 'contacted' }),
      account('b', { pipelineStage: 'contacted' }),
      account('c', { pipelineStage: 'replied' }),
      account('d'),
    ]);
    const byStage = new Map(funnel.map((entry) => [entry.stage, entry.count]));
    expect(byStage.get('contacted')).toBe(2);
    expect(byStage.get('replied')).toBe(1);
    expect(byStage.get('customer_won')).toBe(0);
    expect(funnel.reduce((sum, entry) => sum + entry.count, 0)).toBe(3);
  });
});

describe('reply rate', () => {
  it('uses reached-stage history, so a later loss still counts as contacted', () => {
    const accounts = Array.from({ length: 6 }, (_, index) =>
      account(`a${index}`, { pipelineStage: index === 0 ? 'lost' : 'contacted' }),
    );
    const history = [
      ...accounts.map(({ id }) => ({ accountId: id, toStage: 'contacted' })),
      { accountId: 'a0', toStage: 'replied' },
      { accountId: 'a1', toStage: 'replied' },
      { accountId: 'a2', toStage: 'replied' },
    ];
    const [row] = replyRateBy((entry) => entry.segmentKey, accounts, history);
    expect(row).toMatchObject({
      key: 'independent_pet_retail',
      n: 6,
      numerator: 3,
      ratePct: 50,
      insufficient: false,
    });
  });

  it('reports small samples as insufficient rather than a percentage', () => {
    const accounts = [account('a1'), account('a2')];
    const history = [
      { accountId: 'a1', toStage: 'contacted' },
      { accountId: 'a2', toStage: 'contacted' },
      { accountId: 'a2', toStage: 'replied' },
    ];
    const [row] = replyRateBy((entry) => entry.segmentKey, accounts, history);
    expect(row!.n).toBeLessThan(MIN_SAMPLE);
    expect(row!.insufficient).toBe(true);
    expect(row!.ratePct).toBeNull();
  });
});

describe('win rate', () => {
  it('counts only settled accounts either way', () => {
    const accounts = [
      account('w1', { pipelineStage: 'customer_won' }),
      account('w2', { pipelineStage: 'customer_won' }),
      account('l1', { pipelineStage: 'lost' }),
      account('l2', { pipelineStage: 'disqualified' }),
      account('l3', { pipelineStage: 'lost' }),
      account('moving', { pipelineStage: 'commercial_discussion' }),
    ];
    const [row] = winRateBy((entry) => entry.territoryKey, accounts);
    expect(row).toMatchObject({ key: 'AE-DU', n: 5, numerator: 2, ratePct: 40 });
  });
});

describe('territory rollup', () => {
  it('keeps territory order and separates live pipeline from won', () => {
    const territories = [
      { key: 'AE-DU', name: 'Dubai', kind: 'emirate', parentKey: 'AE' },
      { key: 'QA', name: 'Qatar', kind: 'country', parentKey: null },
    ];
    const rollups = territoryRollup(territories, [
      account('a', { pipelineStage: 'contacted' }),
      account('b', { pipelineStage: 'customer_won' }),
      account('c'),
      account('d', { territoryKey: 'QA' }),
    ]);
    expect(rollups[0]).toMatchObject({
      key: 'AE-DU',
      accounts: 3,
      inPipeline: 1,
      won: 1,
    });
    expect(rollups[1]).toMatchObject({ key: 'QA', accounts: 1, inPipeline: 0, won: 0 });
  });
});
