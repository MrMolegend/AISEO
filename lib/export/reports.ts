import type { Competitor, CompanyLead, Creator } from '@/schemas/research/packages';
import type { StoredSource } from '@/schemas/research/shared';
import type { MarketEntryReport, MarketSource } from '@/schemas/market-entry/report';
import { toCsv, type CsvColumn } from './csv';

/**
 * Column definitions for each exportable list.
 *
 * Stable order, and every row carries its source URLs. A spreadsheet of
 * companies with no way back to where each claim came from is exactly the
 * artefact this product exists not to produce — the citations have to survive
 * the export or they were decoration.
 *
 * Contact columns carry only what a company published. There is no column for a
 * guessed address, because a column is an invitation to fill it.
 */

export type ExportKind = 'competitors' | 'leads' | 'influencers' | 'sources';

/** Turns S-references into the URLs they point at. */
function sourceUrls(refs: readonly string[], sources: readonly StoredSource[]): string {
  const byRef = new Map(sources.map((s) => [s.ref, s.url]));
  return refs
    .map((ref) => byRef.get(ref))
    .filter((url): url is string => Boolean(url))
    .join(' | ');
}

/** Flattens an evidenced claim list to one cell. */
function claims(list: ReadonlyArray<{ statement: string }>): string {
  return list.map((item) => item.statement).join(' | ');
}

export function competitorColumns(
  sources: readonly StoredSource[],
): CsvColumn<Competitor>[] {
  return [
    { header: 'Rank', value: (c) => c.rank },
    { header: 'Name', value: (c) => c.name },
    { header: 'Website', value: (c) => c.website },
    { header: 'Type', value: (c) => c.type },
    { header: 'Why ranked here', value: (c) => c.whyRanked },
    { header: 'Confidence', value: (c) => c.confidence },
    { header: 'Offering', value: (c) => c.offering },
    { header: 'Audience', value: (c) => c.audience },
    { header: 'Positioning', value: (c) => c.positioning },
    { header: 'Marketing message', value: (c) => c.marketingMessage },
    // Two columns rather than one: a reader filtering for "has published
    // pricing" needs the basis, and a cell reading "not publicly available"
    // needs to be distinguishable from an empty one.
    { header: 'Pricing', value: (c) => c.pricing.value ?? 'Not publicly available' },
    { header: 'Pricing basis', value: (c) => c.pricing.basis },
    { header: 'Strengths', value: (c) => claims(c.strengths) },
    { header: 'Weaknesses', value: (c) => claims(c.weaknesses) },
    { header: 'Trust signals', value: (c) => claims(c.trustSignals) },
    { header: 'Review themes', value: (c) => claims(c.reviewThemes) },
    { header: 'Their pitch', value: (c) => c.battlecard.theirPitch },
    { header: 'Where they win', value: (c) => c.battlecard.whereTheyWin },
    { header: 'Where you win', value: (c) => c.battlecard.whereYouWin },
    { header: 'Objection to expect', value: (c) => c.battlecard.objectionToExpect },
    { header: 'Your response', value: (c) => c.battlecard.yourResponse },
    { header: 'Sources', value: (c) => sourceUrls(c.sources, sources) },
  ];
}

export function leadColumns(sources: readonly StoredSource[]): CsvColumn<CompanyLead>[] {
  return [
    { header: 'Rank', value: (l) => l.rank },
    { header: 'Company', value: (l) => l.name },
    { header: 'Website', value: (l) => l.website },
    { header: 'Location', value: (l) => l.location },
    { header: 'Industry', value: (l) => l.industry },
    { header: 'Public description', value: (l) => l.publicDescription },
    { header: 'Fit score', value: (l) => l.fitScore },
    { header: 'Confidence', value: (l) => l.confidence },
    { header: 'Evidence for the fit', value: (l) => claims(l.fitEvidence) },
    { header: 'Possible needs', value: (l) => claims(l.likelyNeeds) },
    { header: 'What to pitch', value: (l) => l.recommendedPitch },
    { header: 'Opening line', value: (l) => l.openingLine },
    { header: 'Email draft', value: (l) => l.emailDraft },
    { header: 'LinkedIn message', value: (l) => l.linkedinMessage },
    { header: 'Short message', value: (l) => l.shortMessage ?? '' },
    { header: 'Contact page', value: (l) => l.contact.contactPageUrl ?? '' },
    // Empty unless the company published this address. Never constructed.
    { header: 'Published email', value: (l) => l.contact.publishedEmail ?? '' },
    { header: 'Sources', value: (l) => sourceUrls(l.sources, sources) },
  ];
}

export function creatorColumns(sources: readonly StoredSource[]): CsvColumn<Creator>[] {
  return [
    { header: 'Rank', value: (c) => c.rank },
    { header: 'Creator', value: (c) => c.name },
    { header: 'Platform', value: (c) => c.platform },
    { header: 'Profiles', value: (c) => c.profileUrls.join(' | ') },
    { header: 'Niche', value: (c) => c.niche },
    { header: 'Location', value: (c) => c.location.value ?? 'Not reliably available' },
    {
      header: 'Audience size',
      value: (c) => c.audienceSize.value ?? 'Not reliably available',
    },
    { header: 'Audience size basis', value: (c) => c.audienceSize.basis },
    { header: 'Brand fit score', value: (c) => c.brandFitScore },
    { header: 'Confidence', value: (c) => c.confidence },
    { header: 'Audience fit', value: (c) => c.audienceFit },
    { header: 'Content style', value: (c) => c.contentStyle },
    { header: 'Evidence', value: (c) => claims(c.evidence) },
    { header: 'Campaign concept', value: (c) => c.campaignConcept },
    { header: 'Opening line', value: (c) => c.openingLine },
    { header: 'Outreach message', value: (c) => c.outreachMessage },
    { header: 'Suggested deliverable', value: (c) => c.suggestedDeliverable },
    { header: 'Compensation approach', value: (c) => c.compensationApproach },
    { header: 'Brand safety notes', value: (c) => c.brandSafetyNotes ?? '' },
    { header: 'Contact page', value: (c) => c.contact.contactPageUrl ?? '' },
    { header: 'Published email', value: (c) => c.contact.publishedEmail ?? '' },
    { header: 'Sources', value: (c) => sourceUrls(c.sources, sources) },
  ];
}

/**
 * The evidence register of a market-entry dossier.
 *
 * The one export the new product has, and the right one: a dossier's value is
 * its sources, and a customer taking a regulatory question to a lawyer or a
 * distributor question to a broker needs the list in something they can sort.
 * Every column here answers "should I believe this" — who published it, whether
 * we opened the page or only read an index summary of it, when it was
 * published, and whether it is about the right country.
 */
function marketSourceColumns(): CsvColumn<MarketSource>[] {
  return [
    { header: 'Reference', value: (s) => s.ref },
    { header: 'Title', value: (s) => s.title ?? '' },
    { header: 'Publisher', value: (s) => s.publisher ?? '' },
    { header: 'Category', value: (s) => s.category.replace(/_/g, ' ') },
    {
      header: 'How we read it',
      value: (s) => (s.retrievalMode === 'direct' ? 'Read directly' : 'Index summary'),
    },
    { header: 'Published', value: (s) => s.publishedAt ?? '' },
    {
      header: 'Geographic relevance',
      value: (s) => s.geographicRelevance.replace(/-/g, ' '),
    },
    { header: 'Confidence', value: (s) => s.confidence },
    { header: 'Retrieved', value: (s) => s.retrievedAt },
    { header: 'URL', value: (s) => s.url },
  ];
}

/** Which lists a report can export, given what it actually contains. */
export function availableExports(report: unknown): ExportKind[] {
  if (!report || typeof report !== 'object') return [];
  const record = report as Record<string, unknown>;

  const kinds: ExportKind[] = [];
  if (Array.isArray(record.competitors) && record.competitors.length > 0) {
    kinds.push('competitors');
  }
  if (Array.isArray(record.leads) && record.leads.length > 0) kinds.push('leads');
  if (Array.isArray(record.creators) && record.creators.length > 0) {
    kinds.push('influencers');
  }
  if (isMarketEntryReport(record) && record.sources.length > 0) kinds.push('sources');
  return kinds;
}

/**
 * Recognised by shape rather than by package id, because this function is given
 * a report and not a job. `sources` alone is not enough — the legacy shapes
 * carry one too — so it is `sources` plus the dossier's own `decision`.
 */
function isMarketEntryReport(
  record: Record<string, unknown>,
): record is Record<string, unknown> & Pick<MarketEntryReport, 'sources'> {
  return (
    Array.isArray(record.sources) &&
    typeof record.decision === 'object' &&
    record.decision !== null
  );
}

/**
 * Renders one export.
 *
 * Returns null rather than an empty file when the report has no such list: a
 * zero-row CSV looks like a bug at the other end.
 */
export function renderExport(
  kind: ExportKind,
  report: unknown,
  sources: readonly StoredSource[],
): string | null {
  if (!report || typeof report !== 'object') return null;
  const record = report as Record<string, unknown>;

  switch (kind) {
    case 'competitors': {
      const rows = record.competitors as Competitor[] | undefined;
      if (!rows?.length) return null;
      return toCsv(rows, competitorColumns(sources));
    }
    case 'leads': {
      const rows = record.leads as CompanyLead[] | undefined;
      if (!rows?.length) return null;
      return toCsv(rows, leadColumns(sources));
    }
    case 'influencers': {
      const rows = record.creators as Creator[] | undefined;
      if (!rows?.length) return null;
      return toCsv(rows, creatorColumns(sources));
    }
    case 'sources': {
      if (!isMarketEntryReport(record)) return null;
      const rows = record.sources;
      if (rows.length === 0) return null;
      return toCsv(rows, marketSourceColumns());
    }
  }
}

export function isExportKind(value: unknown): value is ExportKind {
  return (
    value === 'competitors' ||
    value === 'leads' ||
    value === 'influencers' ||
    value === 'sources'
  );
}
