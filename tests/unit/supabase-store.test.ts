import { describe, it, expect, beforeEach, vi } from 'vitest';
import strongSite from '@/fixtures/audits/strong-site.json';

/**
 * Regression tests for the STORAGE_ERROR on completed reports.
 *
 * Postgres serialises `audits.created_at` (timestamptz) with an explicit
 * offset — `2026-08-23T21:04:33.572839+00:00` — while `z.iso.datetime()` in
 * schemas/audit.ts accepts only the `Z` form. So a report was written
 * successfully, stored intact, and then rejected on the way back out:
 * rowToRecord returned `report: null` for a perfectly good row and the page
 * rendered a STORAGE_ERROR.
 *
 * These drive the real public read path with a stubbed Supabase client, rather
 * than calling the private helper, because the bug was in what the driver does
 * with a row the database actually returns.
 */

/** Set per test; read by the mocked createClient below. */
let nextResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock('@supabase/supabase-js', () => ({
  // Every builder method returns the same chainable object; only the terminal
  // maybeSingle() resolves, which covers both getByPublicId's short chain and
  // findFreshByUrlHash's longer one.
  createClient: () => {
    const chain: any = new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === 'maybeSingle') return async () => nextResult;
          // Vitest awaits thenables; the chain is not one.
          if (prop === 'then') return undefined;
          return () => chain;
        },
      },
    );
    return { from: () => chain };
  },
}));

const { SupabaseAuditStore } = await import('@/lib/storage/supabase-store');

/**
 * A row as Supabase would return it for the fixture audit, with created_at
 * spelled however the test needs.
 */
function completedRow(createdAt: string, overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    public_id: strongSite.publicId,
    requested_url: strongSite.url,
    normalized_url: strongSite.url,
    url_hash: 'a'.repeat(64),
    domain: strongSite.domain,
    status: 'complete',
    stage: 'saving',
    stage_index: 7,
    error_code: null,
    schema_version: strongSite.schemaVersion,
    overall_score: strongSite.overallScore,
    overall_rating: strongSite.overallRating,
    facts: strongSite.facts,
    analysis: strongSite.analysis,
    report_meta: strongSite.meta,
    owner_id: null,
    ip_hash: null,
    created_at: createdAt,
    completed_at: null,
    ...overrides,
  };
}

function newStore() {
  return new SupabaseAuditStore('https://project.supabase.co', 'service-role-not-real');
}

beforeEach(() => {
  nextResult = { data: null, error: null };
});

describe('SupabaseAuditStore.getByPublicId — created_at normalisation', () => {
  it('returns a valid report when Postgres spells created_at with a +00:00 offset', async () => {
    // The exact serialisation observed in production, microseconds and all.
    nextResult = { data: completedRow('2026-08-23T21:04:33.572839+00:00'), error: null };

    const record = await newStore().getByPublicId(strongSite.publicId);

    expect(record).not.toBeNull();
    expect(record!.report).not.toBeNull();
    expect(record!.report!.publicId).toBe(strongSite.publicId);
    expect(record!.report!.overallScore).toBe(strongSite.overallScore);
    // Normalised to canonical UTC, truncated to millisecond resolution.
    expect(record!.report!.createdAt).toBe('2026-08-23T21:04:33.572Z');
    // The record and the report must not disagree about the same instant.
    expect(record!.createdAt).toBe(record!.report!.createdAt);
  });

  it('preserves the instant when normalising a non-zero offset', async () => {
    nextResult = { data: completedRow('2026-08-23T23:04:33.000+02:00'), error: null };

    const record = await newStore().getByPublicId(strongSite.publicId);

    expect(record!.report).not.toBeNull();
    expect(record!.report!.createdAt).toBe('2026-08-23T21:04:33.000Z');
  });

  it('still works when the timestamp already ends in Z', async () => {
    nextResult = { data: completedRow('2026-08-23T21:04:33.572Z'), error: null };

    const record = await newStore().getByPublicId(strongSite.publicId);

    expect(record!.report).not.toBeNull();
    expect(record!.report!.createdAt).toBe('2026-08-23T21:04:33.572Z');
    expect(record!.createdAt).toBe('2026-08-23T21:04:33.572Z');
  });

  it('normalises completed_at the same way, and leaves null alone', async () => {
    nextResult = {
      data: completedRow('2026-08-23T21:04:33.572839+00:00', {
        completed_at: '2026-08-23T21:05:10.100000+00:00',
      }),
      error: null,
    };

    const record = await newStore().getByPublicId(strongSite.publicId);
    expect(record!.completedAt).toBe('2026-08-23T21:05:10.100Z');

    nextResult = { data: completedRow('2026-08-23T21:04:33.572839+00:00'), error: null };
    expect((await newStore().getByPublicId(strongSite.publicId))!.completedAt).toBeNull();
  });

  it('fails safely on an unparseable timestamp rather than throwing', async () => {
    nextResult = { data: completedRow('not-a-timestamp'), error: null };

    const record = await newStore().getByPublicId(strongSite.publicId);

    // The row is still returned — status, stage and error code are all readable —
    // but the report is rejected rather than handed to the renderer half-valid.
    expect(record).not.toBeNull();
    expect(record!.status).toBe('complete');
    expect(record!.report).toBeNull();
    // The unparseable value is passed through untouched, not silently invented.
    expect(record!.createdAt).toBe('not-a-timestamp');
  });

  it('rejects a report whose stored JSON is corrupt, offset or not', async () => {
    nextResult = {
      data: completedRow('2026-08-23T21:04:33.572839+00:00', {
        analysis: { website: 'this is not an AuditAnalysis' },
      }),
      error: null,
    };

    const record = await newStore().getByPublicId(strongSite.publicId);

    expect(record!.report).toBeNull();
  });

  it('leaves an incomplete audit without a report', async () => {
    nextResult = {
      data: completedRow('2026-08-23T21:04:33.572839+00:00', {
        status: 'running',
        stage: 'analysing',
        facts: null,
        analysis: null,
      }),
      error: null,
    };

    const record = await newStore().getByPublicId(strongSite.publicId);

    expect(record!.status).toBe('running');
    expect(record!.report).toBeNull();
    expect(record!.createdAt).toBe('2026-08-23T21:04:33.572Z');
  });

  it('returns null when no row matches', async () => {
    nextResult = { data: null, error: null };
    expect(await newStore().getByPublicId('missing')).toBeNull();
  });
});

describe('SupabaseAuditStore.findFreshByUrlHash — created_at normalisation', () => {
  it('returns a usable cached report from an offset timestamp', async () => {
    nextResult = { data: completedRow('2026-08-23T21:04:33.572839+00:00'), error: null };

    const record = await newStore().findFreshByUrlHash('a'.repeat(64), 86_400_000);

    // A cache hit that carried report: null would serve an empty report page.
    expect(record!.report).not.toBeNull();
    expect(record!.report!.createdAt).toBe('2026-08-23T21:04:33.572Z');
  });
});
