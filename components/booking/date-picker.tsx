'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTime, formatWeekday } from '@/lib/datetime';
import type { DaySlots } from '@/lib/availability';
import { cn } from '@/lib/utils';

/**
 * A horizontally scrolling strip of dates plus a grid of times. It is a
 * deliberately simple picker: the tutor's real availability decides what can be
 * chosen, and days with nothing free are disabled rather than hidden, so the
 * pattern of a week stays visible.
 */
export function DateStrip({
  slots,
  selectedDate,
  onSelect,
}: {
  slots: DaySlots[];
  selectedDate: string | null;
  onSelect: (dateKey: string) => void;
}) {
  return (
    <div className="relative">
      <ul className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {slots.map((day) => {
          const free = day.times.length > 0;
          const active = day.dateKey === selectedDate;
          const date = new Date(day.dateIso);
          return (
            <li key={day.dateKey}>
              <button
                type="button"
                disabled={!free}
                aria-pressed={active}
                onClick={() => onSelect(day.dateKey)}
                className={cn(
                  'flex w-[4.25rem] shrink-0 flex-col items-center gap-0.5 rounded-[var(--radius-control)] border px-2 py-2.5 transition-colors duration-[var(--duration-fast)]',
                  active
                    ? 'border-brand bg-brand text-on-brand'
                    : free
                      ? 'border-line-strong bg-surface text-ink hover:border-brand'
                      : 'border-line bg-surface-sunken text-ink-subtle cursor-not-allowed opacity-60',
                )}
              >
                <span className="text-[0.6875rem] font-medium">
                  {formatWeekday(day.dateIso).slice(0, 3)}
                </span>
                <span className="tabular text-lg leading-none font-semibold">
                  {date.getUTCDate()}
                </span>
                <span className="text-[0.625rem]">
                  {free ? `${day.times.length} free` : 'None'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TimeGrid({
  times,
  selected,
  onSelect,
}: {
  times: string[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  if (times.length === 0) {
    return (
      <p className="text-ink-subtle border-line rounded-[var(--radius-control)] border border-dashed px-4 py-6 text-center text-sm">
        Nothing free on this day. Try another date on the strip above.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {times.map((iso) => {
        const active = iso === selected;
        return (
          <li key={iso}>
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(iso)}
              className={cn(
                'tabular min-h-11 w-full rounded-[var(--radius-control)] border text-sm font-medium transition-colors duration-[var(--duration-fast)]',
                active
                  ? 'border-brand bg-brand text-on-brand'
                  : 'border-line-strong bg-surface text-ink hover:border-brand',
              )}
            >
              {formatTime(iso)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Small helper for the arrows used by the profile's availability preview. */
export function StripNav({
  onPrevious,
  onNext,
  disablePrevious,
  disableNext,
}: {
  onPrevious: () => void;
  onNext: () => void;
  disablePrevious?: boolean;
  disableNext?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onPrevious}
        disabled={disablePrevious}
        className="border-line-strong text-ink-muted hover:text-ink flex size-9 items-center justify-center rounded-[var(--radius-control)] border disabled:opacity-40"
      >
        <ChevronLeft className="size-4" aria-hidden />
        <span className="sr-only">Previous week</span>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disableNext}
        className="border-line-strong text-ink-muted hover:text-ink flex size-9 items-center justify-center rounded-[var(--radius-control)] border disabled:opacity-40"
      >
        <ChevronRight className="size-4" aria-hidden />
        <span className="sr-only">Next week</span>
      </button>
    </div>
  );
}
