import type { MarketEntryReport, ReportSectionId } from '@/schemas/market-entry/report';

/**
 * The claim → source index, computed from the report.
 *
 * Every claim carries the refs of the sources behind it; this walks the
 * document once and inverts that relation, so the evidence explorer can
 * answer "which sections rest on this source" and "which sources back this
 * competitor" without a model, a heuristic, or a second copy of the truth.
 *
 * marketSourceSchema.supports documents itself as "computed, not declared" —
 * this is that computation. (The runner previously stored it empty; it now
 * fills it from here at assembly, and the explorer recomputes for reports
 * stored before that fix, so both eras index identically.)
 */

const SECTION_OF_KEY: Record<string, ReportSectionId> = {
  executive: 'executive',
  commercialContext: 'context',
  marketSignals: 'signals',
  competitive: 'competitive',
  customers: 'customers',
  route: 'route',
  pricing: 'pricing',
  regulation: 'regulation',
  risks: 'risks',
  plan: 'plan',
  appendix: 'appendix',
};

const REF_SHAPE = /^S\d+$/;

/** Collects every source ref reachable under a value. */
function collectRefs(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && REF_SHAPE.test(item)) into.add(item);
      else collectRefs(item, into);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // Only arrays under a `sources` key are citations; a stray "S1" in
      // prose is text, not a reference.
      if (key === 'sources' && Array.isArray(child)) {
        for (const item of child) {
          if (typeof item === 'string' && REF_SHAPE.test(item)) into.add(item);
        }
      } else {
        collectRefs(child, into);
      }
    }
  }
}

export interface EvidenceIndex {
  /** ref → section ids that cite it, in render order. */
  supports: ReadonlyMap<string, ReportSectionId[]>;
  /** competitor name → refs cited anywhere in that competitor's entry. */
  competitorRefs: ReadonlyMap<string, string[]>;
}

export function buildEvidenceIndex(report: MarketEntryReport): EvidenceIndex {
  const bySection = new Map<string, Set<ReportSectionId>>();

  for (const [key, sectionId] of Object.entries(SECTION_OF_KEY)) {
    const section = (report as unknown as Record<string, unknown>)[key];
    if (!section) continue;
    const refs = new Set<string>();
    collectRefs(section, refs);
    for (const ref of refs) {
      if (!bySection.has(ref)) bySection.set(ref, new Set());
      bySection.get(ref)!.add(sectionId);
    }
  }

  const competitorRefs = new Map<string, string[]>();
  for (const competitor of report.competitive.entries) {
    const refs = new Set<string>();
    collectRefs(competitor, refs);
    if (refs.size > 0) competitorRefs.set(competitor.name, [...refs].sort());
  }

  return {
    supports: new Map(
      [...bySection.entries()].map(([ref, sections]) => [ref, [...sections]]),
    ),
    competitorRefs,
  };
}
