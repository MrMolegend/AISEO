'use client';
import { useMemo, useState, useId } from 'react';

/**
 * Search and sort over a long list.
 *
 * The only interactive part of a report, and it exists because 25 leads is more
 * than anyone scrolls through twice. Filtering happens on already-rendered data
 * in the browser: the report is a fixed object, so there is nothing to fetch and
 * no reason to make the user wait.
 *
 * Children are pre-rendered on the server and passed in, which keeps the report
 * sections themselves Server Components — this wrapper only decides which of
 * them to show.
 */

export interface FilterableItem {
  id: string;
  /** Everything a search should match against, joined. */
  searchText: string;
  /** The score used by the "highest scoring" sort. */
  score: number;
  rank: number;
  node: React.ReactNode;
}

export function FilterableList({
  items,
  itemNoun,
}: {
  items: readonly FilterableItem[];
  /** Plural noun for the counts and the empty state: "leads", "creators". */
  itemNoun: string;
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'rank' | 'score'>('rank');
  const searchId = useId();
  const sortId = useId();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? items.filter((item) => item.searchText.toLowerCase().includes(needle))
      : [...items];

    return filtered.sort((a, b) =>
      sort === 'score' ? b.score - a.score || a.rank - b.rank : a.rank - b.rank,
    );
  }, [items, query, sort]);

  return (
    <div>
      <div className="border-rule bg-ground-raised/95 sticky top-16 z-10 -mx-1 mb-4 flex flex-wrap items-end gap-3 border-b px-1 py-3 backdrop-blur-sm print:hidden">
        <div className="min-w-[200px] flex-1">
          <label
            htmlFor={searchId}
            className="text-text-subtle mb-1.5 block text-xs font-medium"
          >
            Search these {itemNoun}
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, industry, location…"
            className="border-rule-strong bg-ground-raised text-text placeholder:text-text-faint focus:border-cobalt focus-visible:ring-cobalt h-10 w-full rounded-[var(--radius-control)] border px-3 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={sortId}
            className="text-text-subtle mb-1.5 block text-xs font-medium"
          >
            Order
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => setSort(event.target.value as 'rank' | 'score')}
            className="border-rule-strong bg-ground-raised text-text focus:border-cobalt focus-visible:ring-cobalt h-10 rounded-[var(--radius-control)] border px-3 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="rank">As ranked</option>
            <option value="score">Highest scoring first</option>
          </select>
        </div>

        {/* Announced, so a screen-reader user learns that typing changed the
            result count rather than discovering it by arrowing through. */}
        <p aria-live="polite" className="text-text-subtle pb-2.5 text-sm tabular-nums">
          {visible.length} of {items.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-text-muted py-10 text-center text-sm">
          No {itemNoun} match “{query}”.
        </p>
      ) : (
        <div className="space-y-4">
          {visible.map((item) => (
            <div key={item.id}>{item.node}</div>
          ))}
        </div>
      )}
    </div>
  );
}
