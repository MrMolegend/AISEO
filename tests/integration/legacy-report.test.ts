import { describe, it, expect, beforeEach } from 'vitest';
import {
  getResearchJobStore,
  resetResearchJobStoreCache,
  resetMemoryJobStore,
  type CreateJobInput,
  type ResearchJobRecord,
} from '@/lib/jobs/store';
import {
  isStageId,
  isCurrentStageId,
  stageLabel,
  LEGACY_STAGE_IDS,
  STAGE_IDS,
} from '@/lib/jobs/stages';
import { reportKindLabel, isLegacyReport, targetMarketLabel } from '@/lib/jobs/labels';
import { RESEARCH_PACKAGE_IDS } from '@/config/packages';
import { MARKET_ENTRY_PACKAGE_ID } from '@/config/report';
import { BRAND } from '@/config/brand';

/**
 * Reports produced by the previous product must stay readable.
 *
 * There are two live rows behind this requirement — one complete
 * competitor-intelligence report and one failed one — and their URLs are the
 * only copy someone has. Nothing in this change migrates them, renames them or
 * rewrites them, so the whole risk is on the read path: a guard that no longer
 * recognises a value it used to write turns a stored row into a throw.
 *
 * The subtlest of those, and the reason this file exists, is the stage column.
 * The storage layer runs `isStageId` over it on every read. The eight CORRIDOR
 * stages share no name with the eleven the old pipeline wrote, so dropping the
 * old names would have made every existing report unreadable — silently, and
 * only in production, where the rows are.
 */

const USER = '44444444-4444-4444-8444-444444444444';

beforeEach(() => {
  resetMemoryJobStore();
  resetResearchJobStoreCache();
});

describe('legacy stage ids still parse', () => {
  it('accepts every stage the previous pipeline wrote', () => {
    for (const stage of LEGACY_STAGE_IDS) {
      expect(isStageId(stage), `${stage} no longer parses`).toBe(true);
    }
  });

  it('accepts every stage this pipeline writes', () => {
    for (const stage of STAGE_IDS) {
      expect(isStageId(stage)).toBe(true);
    }
  });

  it('distinguishes them, so the progress screen shows only current stages', () => {
    for (const stage of LEGACY_STAGE_IDS) {
      expect(isCurrentStageId(stage), `${stage} is being shown as live progress`).toBe(
        false,
      );
    }
    for (const stage of STAGE_IDS) {
      expect(isCurrentStageId(stage)).toBe(true);
    }
  });

  it('labels an unknown stage rather than throwing on it', () => {
    // A stage id from a build older than any list we kept still has to render.
    expect(stageLabel('some-stage-nobody-remembers')).toBe('Working');
    expect(stageLabel('crawling')).toBe('Working');
  });

  it('rejects values that are not stages at all', () => {
    for (const value of [null, undefined, 42, {}, '', 'CONTEXT']) {
      expect(isStageId(value)).toBe(false);
    }
  });
});

describe('a stored legacy job round-trips through the store', () => {
  /** A row shaped like the completed competitor-intelligence report in production. */
  async function storeLegacyJob(
    overrides: Partial<CreateJobInput> = {},
  ): Promise<ResearchJobRecord> {
    const store = await getResearchJobStore();
    const job = await store.create({
      userId: USER,
      packageId: 'competitor-intelligence',
      tokenCost: 250,
      input: {
        packageId: 'competitor-intelligence',
        websiteUrl: 'https://an-old-customer.example',
        businessName: 'An Old Customer',
      } as never,
      inputHash: 'legacy-hash',
      subjectName: 'An Old Customer',
      subjectDomain: 'an-old-customer.example',
      ...overrides,
    });

    await store.complete({
      jobId: job.id,
      report: { summary: { headline: 'A report from the previous product' } },
      sources: [
        {
          ref: 'S1',
          position: 1,
          url: 'https://an-old-customer.example/about',
          title: 'About',
          publisherDomain: 'an-old-customer.example',
          retrievedAt: '2026-01-04T10:00:00.000Z',
          fetched: true,
          excerpt: 'An excerpt.',
        },
      ],
      meta: { promptVersion: 'research-v1', schemaVersion: 1 } as never,
      schemaVersion: 1,
    });

    return (await store.getForUser(job.publicId, USER))!;
  }

  it('reads back complete, with its report and its sources', async () => {
    const job = await storeLegacyJob();

    expect(job.status).toBe('complete');
    expect(job.report).toBeTruthy();
    expect(job.sources).toHaveLength(1);
    expect(job.packageId).toBe('competitor-intelligence');
  });

  it('is served on its existing public URL, unchanged', async () => {
    const job = await storeLegacyJob();
    const store = await getResearchJobStore();

    // The same id, the same route, no redirect: whoever holds the link keeps it.
    const shared = await store.getPublic(job.publicId);
    expect(shared?.publicId).toBe(job.publicId);
    expect(shared?.report).toBeTruthy();
  });

  it('appears in the dashboard listing beside new dossiers', async () => {
    await storeLegacyJob();
    const store = await getResearchJobStore();
    const listed = await store.listForUser(USER, 10);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.packageId).toBe('competitor-intelligence');
  });
});

describe('the renderer dispatch', () => {
  it('routes a market-entry report to the dossier and anything else to the legacy view', () => {
    expect(isLegacyReport(MARKET_ENTRY_PACKAGE_ID)).toBe(false);
    // The legacy catalogue has no market-entry entry, so every id in it is by
    // definition from the previous product.
    for (const packageId of RESEARCH_PACKAGE_IDS) {
      expect(
        isLegacyReport(packageId),
        `${packageId} is not being treated as legacy`,
      ).toBe(true);
    }
  });

  it('names every stored package without consulting a catalogue that lacks it', () => {
    // A dashboard that called the old catalogue with a market-entry id used to
    // throw on the row it was most likely to be showing.
    expect(reportKindLabel(MARKET_ENTRY_PACKAGE_ID)).toBe(BRAND.defaultReportTitle);
    for (const packageId of RESEARCH_PACKAGE_IDS) {
      expect(reportKindLabel(packageId).length).toBeGreaterThan(0);
    }
    expect(reportKindLabel('a-package-that-no-longer-exists' as never)).toBe(
      'Research report',
    );
  });

  it('does not render a legacy job’s stored hostname as if it were a country', async () => {
    // Both eras use subject_domain; only one of them puts an ISO code there.
    const legacy = {
      packageId: 'competitor-intelligence',
      subjectDomain: 'an-old-customer.example',
    } as ResearchJobRecord;
    expect(targetMarketLabel(legacy)).toBeNull();

    const dossier = {
      packageId: MARKET_ENTRY_PACKAGE_ID,
      subjectDomain: 'AE',
    } as ResearchJobRecord;
    expect(targetMarketLabel(dossier)).toBe('United Arab Emirates');
  });
});
