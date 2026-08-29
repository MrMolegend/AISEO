'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Meta } from '@/components/ui/panel';
import { VERDICT_LABEL, VERDICT_TOKEN, type Verdict } from '@/config/design';

export interface DossierRow {
  publicId: string;
  subject: string;
  market: string;
  kind: string;
  legacy: boolean;
  status: string;
  updatedAt: string;
  verdict: Verdict | null;
  confidence: string | null;
  errorTitle: string | null;
}

/**
 * The dossier list, with search that only appears when it earns its place.
 *
 * Below six rows a filter is furniture: it takes vertical space, adds a control
 * to tab through, and answers a question nobody has when the whole list is on
 * screen. Above six it becomes the fastest way to find the assessment you half
 * remember, so it appears then and not before.
 */
const FILTER_THRESHOLD = 6;

export function DossierFilter({ rows }: { count: number; rows: DossierRow[] }) {
  const [query, setQuery] = useState('');
  const showFilter = rows.length > FILTER_THRESHOLD;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return rows;
    return rows.filter((row) =>
      [row.subject, row.market, row.kind].join(' ').toLowerCase().includes(needle),
    );
  }, [query, rows]);

  if (rows.length === 0) {
    return <p className="text-text-faint text-[14px]">No completed assessments yet.</p>;
  }

  return (
    <div>
      {showFilter && (
        <div className="mb-4">
          <label htmlFor="dossier-filter" className="sr-only">
            Filter dossiers by business or market
          </label>
          <input
            id="dossier-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by business or market"
            className="border-rule-strong bg-ground-raised text-text placeholder:text-text-faint focus:border-cobalt h-11 w-full max-w-sm border px-3.5 text-[14px] outline-none"
          />
          <p aria-live="polite" className="text-text-faint mt-1.5 text-[12px]">
            {filtered.length} of {rows.length} shown
          </p>
        </div>
      )}

      <ul className="space-y-px">
        {filtered.map((row) => (
          <li key={row.publicId}>
            <Link
              href={`/research/${row.publicId}`}
              className="border-rule bg-ground-raised hover:border-rule-strong flex flex-col gap-3 border p-4 transition-colors sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {row.verdict ? (
                    <Badge tone="token" token={VERDICT_TOKEN[row.verdict]} size="sm">
                      {VERDICT_LABEL[row.verdict]}
                    </Badge>
                  ) : row.errorTitle ? (
                    <Badge tone="copper" size="sm">
                      Not completed
                    </Badge>
                  ) : (
                    <Badge size="sm">Complete</Badge>
                  )}
                  {row.legacy && <Badge size="sm">Earlier version</Badge>}
                  {row.confidence && <Meta>confidence {row.confidence}</Meta>}
                </div>

                <p className="text-text mt-2 truncate text-[15px] font-medium">
                  {row.subject}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  {row.market && <Meta>{row.market}</Meta>}
                  <Meta>{row.kind}</Meta>
                </div>
                {row.errorTitle && (
                  <p className="text-text-subtle mt-1.5 text-[13px]">{row.errorTitle}</p>
                )}
              </div>

              <Meta className="shrink-0">
                <time dateTime={row.updatedAt}>{row.updatedAt.slice(0, 10)}</time>
              </Meta>
            </Link>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="text-text-faint mt-4 text-[14px]">Nothing matches that filter.</p>
      )}
    </div>
  );
}
