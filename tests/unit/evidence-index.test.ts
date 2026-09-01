import { describe, it, expect } from 'vitest';
import { buildEvidenceIndex } from '@/lib/market-entry/evidence-index';
import { EXAMPLE_DOSSIER } from '@/fixtures/market-entry/example-dossier';

/**
 * The claim → source inversion: deterministic, ref-scoped, and honest about
 * where a citation lives.
 */

describe('buildEvidenceIndex', () => {
  it('maps every cited ref to the sections that cite it', () => {
    const index = buildEvidenceIndex(EXAMPLE_DOSSIER);

    // The executive's own citations must land in 'executive'.
    for (const ref of EXAMPLE_DOSSIER.executive.attractiveness.sources) {
      expect(index.supports.get(ref)).toContain('executive');
    }
    // A regulatory requirement's evidence lands in 'regulation'.
    const requirement = EXAMPLE_DOSSIER.regulation.requirements[0];
    for (const ref of requirement?.evidence[0]?.sources ?? []) {
      expect(index.supports.get(ref)).toContain('regulation');
    }
  });

  it('only reads refs from `sources` arrays, never from prose', () => {
    const doctored = JSON.parse(
      JSON.stringify(EXAMPLE_DOSSIER),
    ) as typeof EXAMPLE_DOSSIER;
    doctored.executive.summary = 'S999 appears in prose and must not count.';
    const index = buildEvidenceIndex(doctored);
    expect(index.supports.has('S999')).toBe(false);
  });

  it('is deterministic', () => {
    const first = buildEvidenceIndex(EXAMPLE_DOSSIER);
    const second = buildEvidenceIndex(EXAMPLE_DOSSIER);
    expect(JSON.stringify([...first.supports.entries()])).toBe(
      JSON.stringify([...second.supports.entries()]),
    );
  });

  it('collects each competitor’s citations under its name', () => {
    const index = buildEvidenceIndex(EXAMPLE_DOSSIER);
    for (const competitor of EXAMPLE_DOSSIER.competitive.entries) {
      const refs = index.competitorRefs.get(competitor.name);
      const cited = competitor.marketPresence.sources;
      if (cited.length > 0) {
        expect(refs).toBeDefined();
        for (const ref of cited) expect(refs).toContain(ref);
      }
    }
  });
});
