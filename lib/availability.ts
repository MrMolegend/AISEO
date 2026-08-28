import { DAY, todayUtc } from '@/lib/datetime';
import type { AvailabilitySlot } from '@/lib/types';

export interface DaySlots {
  /** "2026-04-20" — the key used for blocked dates. */
  dateKey: string;
  /** Midnight UTC on that day, as an ISO instant. */
  dateIso: string;
  /** Bookable start times, as ISO instants. */
  times: string[];
}

function toDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function minutesFrom(time: string): number {
  const [hours, mins] = time.split(':');
  return Number(hours) * 60 + Number(mins ?? 0);
}

/**
 * Turns a tutor's weekly pattern into concrete bookable times.
 *
 * Slots start on the hour and must finish inside the block, so a 09:00–13:00
 * window offers three starts for a 90-minute lesson rather than four. Times in
 * the past and dates the tutor has blocked out are dropped.
 */
export function generateSlots({
  availability,
  days = 21,
  durationMins = 60,
  unavailableDates = [],
  now = Date.now(),
  minNoticeHours = 2,
}: {
  availability: AvailabilitySlot[];
  days?: number;
  durationMins?: number;
  unavailableDates?: string[];
  now?: number;
  minNoticeHours?: number;
}): DaySlots[] {
  const start = todayUtc();
  const earliest = now + minNoticeHours * 60 * 60 * 1000;
  const result: DaySlots[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    const dayStart = start + offset * DAY;
    const dateKey = toDateKey(dayStart);
    if (unavailableDates.includes(dateKey)) {
      result.push({ dateKey, dateIso: new Date(dayStart).toISOString(), times: [] });
      continue;
    }

    const weekday = new Date(dayStart).getUTCDay();
    const times: string[] = [];

    for (const slot of availability.filter((s) => s.day === weekday)) {
      const from = minutesFrom(slot.start);
      const to = minutesFrom(slot.end);
      for (let mins = from; mins + durationMins <= to; mins += 60) {
        const instant = dayStart + mins * 60_000;
        if (instant >= earliest) times.push(new Date(instant).toISOString());
      }
    }

    result.push({
      dateKey,
      dateIso: new Date(dayStart).toISOString(),
      times: times.sort(),
    });
  }

  return result;
}

/** The first bookable time in a generated set, or undefined if there is none. */
export function firstAvailable(slots: DaySlots[]): string | undefined {
  for (const day of slots) {
    if (day.times[0]) return day.times[0];
  }
  return undefined;
}

export const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
] as const;
