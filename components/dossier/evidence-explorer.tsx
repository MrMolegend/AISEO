'use client';
import { useMemo, useState } from 'react';
import { Rule, Meta } from '@/components/ui/panel';
import { cn } from '@/lib/utils';
import { REPORT_SECTIONS, type ReportSectionId } from '@/schemas/market-entry/report';
import type { MarketSource } from '@/schemas/market-entry/report';

/**
 * The evidence explorer.
 *
 * Every material claim in a dossier resolves to sources; this is the surface
 * where those sources are first-class — filterable by who published them, how
 * they were obtained, how confident the pipeline was, which section leans on
 * them and which competitor they concern. Nothing here is fetched or
 * generated: it is the stored evidence, indexed.
 *
 * Two honesty rules carry through. Retrieval mode is always visible — an
 * indexed summary is labelled as one, because "we read this page" and "a
 * search engine described this page" are different strengths of evidence.
 * And the sources the pipeline could not read are listed at the bottom as
 * limitations, not hidden — with no affordance to "try harder", because
 * bypassing a refusal is not on the menu.
 */

export interface BlockedEntry {
  url: string;
  publisher: string | null;
  reason: string;
}

const SECTION_LABEL = new Map<string, string>(
  REPORT_SECTIONS.map((section) => [section.id, section.label]),
);

const BLOCKED_REASON_LABEL: Record<string, string> = {
  'robots-disallowed': 'The site asks automated readers to stay out',
  'platform-policy': 'A platform we do not scrape',
  unreachable: 'Could not be reached',
  timeout: 'Did not respond in time',
  'not-readable': 'Not a readable page',
  'too-large': 'Larger than the reader accepts',
  'blocked-by-site': 'The site refused the request',
};

function categoryLabel(category: string): string {
  return category.replace(/_/g, ' ');
}

export function EvidenceExplorer({
  sources,
  blocked,
  competitors,
}: {
  sources: MarketSource[];
  blocked: BlockedEntry[];
  /** competitor name → refs its entry cites. */
  competitors: { name: string; refs: string[] }[];
}) {
  const [category, setCategory] = useState('all');
  const [mode, setMode] = useState('all');
  const [confidence, setConfidence] = useState('all');
  const [section, setSection] = useState('all');
  const [competitor, setCompetitor] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const categories = useMemo(
    () => [...new Set(sources.map((source) => source.category))].sort(),
    [sources],
  );
  const sections = useMemo(() => {
    const present = new Set(sources.flatMap((source) => source.supports));
    return REPORT_SECTIONS.filter((entry) => present.has(entry.id));
  }, [sources]);

  const competitorRefs = useMemo(
    () => new Map(competitors.map((entry) => [entry.name, new Set(entry.refs)])),
    [competitors],
  );

  const filtered = sources.filter((source) => {
    if (category !== 'all' && source.category !== category) return false;
    if (mode !== 'all' && source.retrievalMode !== mode) return false;
    if (confidence !== 'all' && source.confidence !== confidence) return false;
    if (section !== 'all' && !source.supports.includes(section as ReportSectionId)) {
      return false;
    }
    if (competitor !== 'all' && !competitorRefs.get(competitor)?.has(source.ref)) {
      return false;
    }
    if (search.trim().length > 0) {
      const needle = search.trim().toLowerCase();
      const haystack =
        `${source.title ?? ''} ${source.publisher ?? ''} ${source.url}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const select = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <div>
      <label htmlFor={id} className="text-text-subtle mb-1.5 block text-[12px]">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-rule-strong bg-ground-raised text-text w-full border px-2.5 py-2 text-[13px]"
      >
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div>
      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {select(
          'filter-category',
          'Publisher kind',
          category,
          setCategory,
          categories.map((value) => ({ value, label: categoryLabel(value) })),
        )}
        {select('filter-mode', 'Retrieval', mode, setMode, [
          { value: 'direct', label: 'Read directly' },
          { value: 'indexed', label: 'Index summary' },
        ])}
        {select('filter-confidence', 'Confidence', confidence, setConfidence, [
          { value: 'high', label: 'High' },
          { value: 'medium', label: 'Medium' },
          { value: 'low', label: 'Low' },
        ])}
        {select(
          'filter-section',
          'Cited in',
          section,
          setSection,
          sections.map((entry) => ({ value: entry.id, label: entry.label })),
        )}
        {select(
          'filter-competitor',
          'Competitor',
          competitor,
          setCompetitor,
          competitors.map((entry) => ({ value: entry.name, label: entry.name })),
        )}
        <div>
          <label
            htmlFor="filter-search"
            className="text-text-subtle mb-1.5 block text-[12px]"
          >
            Search
          </label>
          <input
            id="filter-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, publisher, address"
            className="border-rule-strong bg-ground-raised text-text placeholder:text-text-faint w-full border px-2.5 py-2 text-[13px]"
          />
        </div>
      </div>

      <p role="status" className="text-text-subtle mt-4 text-[13px]" data-numeric>
        {filtered.length} of {sources.length} sources
      </p>

      {/* ── Sources ────────────────────────────────────────────────────── */}
      <ul className="mt-4 space-y-2">
        {filtered.map((source) => {
          const expanded = open === source.ref;
          return (
            <li key={source.ref} className="border-rule border p-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-text-faint shrink-0 text-[12px]" data-numeric>
                  {source.ref}
                </span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text hover:text-cobalt min-w-0 flex-1 text-[14px] leading-snug underline-offset-4 hover:underline"
                >
                  {source.title ?? source.url}
                </a>
                <span
                  className={cn(
                    'shrink-0 text-[11px] tracking-wide uppercase',
                    source.retrievalMode === 'direct'
                      ? 'text-signal'
                      : 'text-text-subtle',
                  )}
                >
                  {source.retrievalMode === 'direct' ? 'Read directly' : 'Index summary'}
                </span>
              </div>

              <div className="text-text-subtle mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[12px]">
                {source.publisher && <span>{source.publisher}</span>}
                <span>{categoryLabel(source.category)}</span>
                <span>confidence: {source.confidence}</span>
                {source.publishedAt && (
                  <span data-numeric>published {source.publishedAt}</span>
                )}
                <span data-numeric>retrieved {source.retrievedAt.slice(0, 10)}</span>
              </div>

              {source.supports.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {source.supports.map((sectionId) => (
                    <span
                      key={sectionId}
                      className="border-rule text-text-muted border px-1.5 py-0.5 text-[11px]"
                    >
                      {SECTION_LABEL.get(sectionId) ?? sectionId}
                    </span>
                  ))}
                </div>
              )}

              {source.excerpt && (
                <div className="mt-2">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : source.ref)}
                    className="text-cobalt text-[12px] underline-offset-4 hover:underline"
                  >
                    {expanded ? 'Hide excerpt' : 'Show excerpt'}
                  </button>
                  {expanded && (
                    <blockquote className="border-rule text-text-muted mt-2 border-l-2 pl-3 text-[13px] leading-relaxed">
                      {source.excerpt}
                    </blockquote>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {filtered.length === 0 && (
          <li className="text-text-faint border-rule border border-dashed p-6 text-center text-[13px]">
            No sources match these filters.
          </li>
        )}
      </ul>

      {/* ── What could not be read ─────────────────────────────────────── */}
      {blocked.length > 0 && (
        <section aria-labelledby="blocked-heading" className="mt-12">
          <h2 id="blocked-heading" className="text-text text-[15px] font-medium">
            Found but not readable
          </h2>
          <p className="text-text-muted measure mt-1 text-[13px] leading-relaxed">
            These pages surfaced in the research but could not be read, so nothing in the
            report rests on their contents. A site that refuses automated readers is
            respected, not retried harder.
          </p>
          <Rule className="mt-3" />
          <ul className="mt-3 space-y-1.5">
            {blocked.map((entry) => (
              <li
                key={entry.url}
                className="flex flex-wrap items-baseline gap-x-3 text-[13px]"
              >
                <span className="text-text-muted min-w-0 flex-1 break-all">
                  {entry.publisher ?? entry.url}
                </span>
                <span className="text-text-faint shrink-0">
                  {BLOCKED_REASON_LABEL[entry.reason] ?? entry.reason}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-text-faint mt-10 text-[12px] leading-relaxed">
        <Meta>Provenance</Meta>
        <span className="mt-1 block">
          Facts you supplied in the brief are labelled as customer-provided wherever they
          appear in the report; everything cited here is public evidence gathered at
          research time. Statements graded below “verified” are the pipeline&rsquo;s
          inferences and are marked as such in the dossier.
        </span>
      </p>
    </div>
  );
}
