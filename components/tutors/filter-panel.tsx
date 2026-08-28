'use client';

import { Checkbox, Select } from '@/components/ui/field';
import { priceBounds } from '@/lib/queries';
import { educationLevels, levelLabels } from '@/lib/data/subjects';
import { formatPounds } from '@/lib/utils';
import type { EducationLevel, Subject, TutorFilters } from '@/lib/types';

const RATINGS = [
  { value: 0, label: 'Any rating' },
  { value: 4, label: '4.0 and above' },
  { value: 4.5, label: '4.5 and above' },
  { value: 4.8, label: '4.8 and above' },
];

const AVAILABILITY = [
  { value: null, label: 'Any time' },
  { value: 1, label: 'Within 24 hours' },
  { value: 3, label: 'Within 3 days' },
  { value: 7, label: 'Within a week' },
];

/**
 * The filter controls themselves. Rendered inside the desktop sidebar and
 * inside the mobile bottom sheet, so the two can never drift apart.
 */
export function FilterPanel({
  filters,
  subjects,
  onChange,
}: {
  filters: TutorFilters;
  subjects: Subject[];
  onChange: (patch: Partial<TutorFilters>) => void;
}) {
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-ink mb-2 text-sm font-semibold">Subject</legend>
        <Select
          value={filters.subject ?? ''}
          onChange={(event) => onChange({ subject: event.target.value || null })}
          aria-label="Subject"
        >
          <option value="">All subjects</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>
              {subject.name}
            </option>
          ))}
        </Select>
      </fieldset>

      <fieldset>
        <legend className="text-ink mb-2 text-sm font-semibold">Education level</legend>
        <div className="grid grid-cols-2 gap-2">
          {educationLevels.map((level) => {
            const active = filters.level === level;
            return (
              <button
                key={level}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange({ level: active ? null : (level as EducationLevel) })
                }
                className={`min-h-11 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)] ${
                  active
                    ? 'border-brand bg-brand-subtle text-brand-ink'
                    : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink'
                }`}
              >
                {levelLabels[level]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-ink mb-2 text-sm font-semibold">Price per hour</legend>
        <p className="text-ink-subtle tabular mb-3 text-sm">
          {formatPounds(filters.minPrice)} – {formatPounds(filters.maxPrice)}
        </p>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="filter-min-price"
              className="text-ink-subtle mb-1 block text-xs font-medium"
            >
              Minimum
            </label>
            <input
              id="filter-min-price"
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={1}
              value={filters.minPrice}
              onChange={(event) =>
                onChange({
                  minPrice: Math.min(Number(event.target.value), filters.maxPrice),
                })
              }
              className="accent-brand w-full"
            />
          </div>
          <div>
            <label
              htmlFor="filter-max-price"
              className="text-ink-subtle mb-1 block text-xs font-medium"
            >
              Maximum
            </label>
            <input
              id="filter-max-price"
              type="range"
              min={priceBounds.min}
              max={priceBounds.max}
              step={1}
              value={filters.maxPrice}
              onChange={(event) =>
                onChange({
                  maxPrice: Math.max(Number(event.target.value), filters.minPrice),
                })
              }
              className="accent-brand w-full"
            />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-ink mb-2 text-sm font-semibold">Rating</legend>
        <Select
          value={String(filters.minRating)}
          onChange={(event) => onChange({ minRating: Number(event.target.value) })}
          aria-label="Minimum rating"
        >
          {RATINGS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </fieldset>

      <fieldset>
        <legend className="text-ink mb-2 text-sm font-semibold">Availability</legend>
        <Select
          value={
            filters.availableWithinDays === null
              ? ''
              : String(filters.availableWithinDays)
          }
          onChange={(event) =>
            onChange({
              availableWithinDays: event.target.value ? Number(event.target.value) : null,
            })
          }
          aria-label="Available within"
        >
          {AVAILABILITY.map((option) => (
            <option key={option.label} value={option.value ?? ''}>
              {option.label}
            </option>
          ))}
        </Select>
      </fieldset>

      <div className="border-line border-t pt-5">
        <Checkbox
          label="Verified tutors only"
          description="Application reviewed and documents checked."
          checked={filters.verifiedOnly}
          onChange={(event) => onChange({ verifiedOnly: event.target.checked })}
        />
      </div>
    </div>
  );
}
