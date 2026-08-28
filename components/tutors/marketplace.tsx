'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  Rows3,
  Search,
  SlidersHorizontal,
  UserSearch,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Segmented } from '@/components/ui/tabs';
import { BottomSheet } from '@/components/ui/overlay';
import { EmptyState } from '@/components/ui/states';
import { FilterPanel } from './filter-panel';
import { TutorCard } from './tutor-card';
import { TutorListRow } from './tutor-list-row';
import { useDemo } from '@/lib/store/demo-store';
import {
  countActiveFilters,
  defaultFilters,
  filterTutors,
  priceBounds,
  subjectName,
} from '@/lib/queries';
import { levelLabels } from '@/lib/data/subjects';
import { formatPounds, pluralise } from '@/lib/utils';
import type { Subject, TutorFilters, TutorSort } from '@/lib/types';

const SORTS: { value: TutorSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'soonest', label: 'Soonest available' },
];

/**
 * The marketplace.
 *
 * Filtering and sorting run against the real tutor list through
 * `filterTutors`, and the current state is mirrored into the address bar with
 * `history.replaceState` so a search can be shared without the page navigating
 * on every keystroke.
 */
export function Marketplace({
  subjects,
  initialFilters,
}: {
  subjects: Subject[];
  initialFilters: TutorFilters;
}) {
  const { tutors, isSuspended } = useDemo();
  const [filters, setFilters] = useState<TutorFilters>(initialFilters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const patch = useCallback((update: Partial<TutorFilters>) => {
    setFilters((current) => ({ ...current, ...update }));
  }, []);

  const visible = useMemo(
    () => tutors.filter((tutor) => !isSuspended(tutor.id)),
    [tutors, isSuspended],
  );

  const results = useMemo(() => filterTutors(visible, filters), [visible, filters]);
  const activeCount = countActiveFilters(filters);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query.trim()) params.set('q', filters.query.trim());
    if (filters.subject) params.set('subject', filters.subject);
    if (filters.level) params.set('level', filters.level);
    if (filters.minPrice > priceBounds.min) params.set('min', String(filters.minPrice));
    if (filters.maxPrice < priceBounds.max) params.set('max', String(filters.maxPrice));
    if (filters.minRating > 0) params.set('rating', String(filters.minRating));
    if (filters.availableWithinDays !== null)
      params.set('within', String(filters.availableWithinDays));
    if (filters.verifiedOnly) params.set('verified', '1');
    if (filters.sort !== 'recommended') params.set('sort', filters.sort);

    const next = `${window.location.pathname}${params.size ? `?${params}` : ''}`;
    window.history.replaceState(null, '', next);
  }, [filters]);

  const chips = buildChips(filters, patch);

  return (
    <div className="container-page py-8 lg:py-10">
      <div className="max-w-2xl">
        <h1 className="text-[1.75rem] tracking-[var(--tracking-tight)] sm:text-[2rem]">
          Find a tutor
        </h1>
        <p className="text-ink-muted mt-2 leading-relaxed">
          Every tutor sets their own rate and hours. Filter down to the ones who teach
          your subject at your level, then compare how they work.
        </p>
      </div>

      <div className="mt-6 flex gap-2.5">
        <div className="relative flex-1">
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
            aria-hidden
          />
          <label htmlFor="marketplace-search" className="sr-only">
            Search tutors
          </label>
          <input
            id="marketplace-search"
            type="search"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
            placeholder="Search by subject, topic or tutor name"
            className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle/80 hover:border-ink-subtle/60 focus:border-brand h-12 w-full rounded-[var(--radius-control)] border pr-3.5 pl-10 text-[0.9375rem]"
          />
        </div>
        <Button
          variant="secondary"
          className="h-12 shrink-0 lg:hidden"
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal className="size-[18px]" aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="bg-brand text-on-brand ml-0.5 flex size-5 items-center justify-center rounded-full text-xs font-semibold">
              {activeCount}
            </span>
          )}
        </Button>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold">Filters</h2>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilters({ ...defaultFilters, sort: filters.sort })}
                  className="text-brand text-sm font-medium hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <FilterPanel filters={filters} subjects={subjects} onChange={patch} />
          </div>
        </aside>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-ink font-medium" role="status" aria-live="polite">
                {results.length} {pluralise(results.length, 'tutor')}
              </p>
              <p className="text-ink-subtle mt-0.5 text-sm">{summarise(filters)}</p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="marketplace-sort" className="sr-only">
                Sort results
              </label>
              <Select
                id="marketplace-sort"
                value={filters.sort}
                onChange={(event) => patch({ sort: event.target.value as TutorSort })}
                className="h-10 w-auto min-w-44 text-sm"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Segmented
                label="Result layout"
                value={view}
                onChange={setView}
                className="hidden sm:inline-flex"
                options={[
                  {
                    value: 'grid',
                    label: 'Grid',
                    icon: <LayoutGrid className="size-4" aria-hidden />,
                  },
                  {
                    value: 'list',
                    label: 'List',
                    icon: <Rows3 className="size-4" aria-hidden />,
                  },
                ]}
              />
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.label}>
                  <button
                    type="button"
                    onClick={chip.clear}
                    className="border-brand-line bg-brand-subtle text-brand-ink hover:bg-brand-line/60 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium"
                  >
                    {chip.label}
                    <X className="size-3.5" aria-hidden />
                    <span className="sr-only">Remove filter</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setFilters({ ...defaultFilters, sort: filters.sort })}
                  className="text-ink-subtle hover:text-ink inline-flex min-h-9 items-center px-2 text-sm font-medium underline underline-offset-4"
                >
                  Clear all
                </button>
              </li>
            </ul>
          )}

          <div className="mt-6">
            {results.length === 0 ? (
              <EmptyState
                icon={<UserSearch className="size-6" aria-hidden />}
                title="No tutors match these filters"
                body="Try widening the price range, removing the level filter, or searching for a broader subject."
              />
            ) : view === 'grid' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {results.map((tutor) => (
                  <TutorCard key={tutor.id} tutor={tutor} />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((tutor) => (
                  <TutorListRow key={tutor.id} tutor={tutor} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Filters"
        description={`${activeCount} active`}
        footer={
          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setFilters({ ...defaultFilters, sort: filters.sort })}
            >
              Clear all
            </Button>
            <Button className="flex-[1.4]" onClick={() => setSheetOpen(false)}>
              Show {results.length} {pluralise(results.length, 'tutor')}
            </Button>
          </div>
        }
      >
        <FilterPanel filters={filters} subjects={subjects} onChange={patch} />
      </BottomSheet>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function summarise(filters: TutorFilters): string {
  const parts: string[] = [];
  parts.push(filters.subject ? subjectName(filters.subject) : 'All subjects');
  if (filters.level) parts.push(levelLabels[filters.level] ?? filters.level);
  if (filters.minPrice > priceBounds.min || filters.maxPrice < priceBounds.max) {
    parts.push(
      `${formatPounds(filters.minPrice)}–${formatPounds(filters.maxPrice)} an hour`,
    );
  }
  if (filters.verifiedOnly) parts.push('verified only');
  return parts.join(' · ');
}

function buildChips(
  filters: TutorFilters,
  patch: (update: Partial<TutorFilters>) => void,
): { label: string; clear: () => void }[] {
  const chips: { label: string; clear: () => void }[] = [];

  if (filters.query.trim()) {
    chips.push({ label: `“${filters.query.trim()}”`, clear: () => patch({ query: '' }) });
  }
  if (filters.subject) {
    chips.push({
      label: subjectName(filters.subject),
      clear: () => patch({ subject: null }),
    });
  }
  if (filters.level) {
    chips.push({
      label: levelLabels[filters.level] ?? filters.level,
      clear: () => patch({ level: null }),
    });
  }
  if (filters.minPrice > priceBounds.min || filters.maxPrice < priceBounds.max) {
    chips.push({
      label: `${formatPounds(filters.minPrice)}–${formatPounds(filters.maxPrice)}`,
      clear: () => patch({ minPrice: priceBounds.min, maxPrice: priceBounds.max }),
    });
  }
  if (filters.minRating > 0) {
    chips.push({
      label: `${filters.minRating.toFixed(1)}+ rating`,
      clear: () => patch({ minRating: 0 }),
    });
  }
  if (filters.availableWithinDays !== null) {
    chips.push({
      label:
        filters.availableWithinDays === 1
          ? 'Free within 24 hours'
          : `Free within ${filters.availableWithinDays} days`,
      clear: () => patch({ availableWithinDays: null }),
    });
  }
  if (filters.verifiedOnly) {
    chips.push({ label: 'Verified only', clear: () => patch({ verifiedOnly: false }) });
  }

  return chips;
}
