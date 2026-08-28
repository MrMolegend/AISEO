/**
 * Date and money formatting for demo data.
 *
 * Two rules, both learned the hard way:
 *
 * 1. Every demo instant is a UTC instant and every formatter here reads UTC
 *    fields. The server renders in UTC and the browser in the visitor's zone,
 *    so anything else produces two different strings for the same date.
 *
 * 2. The strings are composed by hand rather than by `Intl.DateTimeFormat`.
 *    Node's ICU and the browser's disagree on the details — `en-GB` with a
 *    short weekday gives "Sun 30 Aug" on the server and "Sun, 30 Aug" in
 *    Chrome — and React reports that as a hydration failure.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

function parts(iso: string) {
  const date = new Date(iso);
  return {
    weekdayLong: WEEKDAYS_LONG[date.getUTCDay()] ?? '',
    weekdayShort: (WEEKDAYS_LONG[date.getUTCDay()] ?? '').slice(0, 3),
    day: date.getUTCDate(),
    monthLong: MONTHS_LONG[date.getUTCMonth()] ?? '',
    monthShort: (MONTHS_LONG[date.getUTCMonth()] ?? '').slice(0, 3),
    year: date.getUTCFullYear(),
    hours: date.getUTCHours(),
    minutes: date.getUTCMinutes(),
  };
}

/** Midnight UTC today — the anchor every demo date is built from. */
export function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** An instant `days` from today at `hour:minute` UTC, as an ISO string. */
export function at(days: number, hour: number, minute = 0): string {
  return new Date(todayUtc() + days * DAY + hour * HOUR + minute * MINUTE).toISOString();
}

/** "Sun 30 Aug" */
export function formatDate(iso: string): string {
  const p = parts(iso);
  return `${p.weekdayShort} ${p.day} ${p.monthShort}`;
}

/** "Sunday 30 August" */
export function formatLongDate(iso: string): string {
  const p = parts(iso);
  return `${p.weekdayLong} ${p.day} ${p.monthLong}`;
}

/** "30 Aug 2026" */
export function formatDayMonth(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${p.monthShort} ${p.year}`;
}

/** "17:30" */
export function formatTime(iso: string): string {
  const p = parts(iso);
  return `${pad(p.hours)}:${pad(p.minutes)}`;
}

export function formatWeekday(iso: string): string {
  return parts(iso).weekdayLong;
}

export function formatMonthYear(iso: string): string {
  const p = parts(iso);
  return `${p.monthLong} ${p.year}`;
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

function startOfDay(iso: string): number {
  const date = new Date(iso);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** "Today", "Tomorrow", or a short date. */
export function formatRelativeDay(iso: string): string {
  const diff = Math.round((startOfDay(iso) - todayUtc()) / DAY);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDate(iso);
}

/** "in 3 days", "2 hours ago". Coarse by design — nothing ticks. */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const future = diff > 0;
  const abs = Math.abs(diff);

  const phrase = (value: number, unit: string) => {
    const plural = value === 1 ? unit : `${unit}s`;
    return future ? `in ${value} ${plural}` : `${value} ${plural} ago`;
  };

  if (abs < MINUTE) return 'just now';
  if (abs < HOUR) return phrase(Math.round(abs / MINUTE), 'minute');
  if (abs < DAY) return phrase(Math.round(abs / HOUR), 'hour');
  if (abs < 7 * DAY) return phrase(Math.round(abs / DAY), 'day');
  return phrase(Math.round(abs / (7 * DAY)), 'week');
}

/** Short label for a message list: time today, weekday this week, else a date. */
export function formatMessageStamp(iso: string): string {
  const diff = Math.round((todayUtc() - startOfDay(iso)) / DAY);
  if (diff === 0) return formatTime(iso);
  if (diff <= 6) return parts(iso).weekdayShort;
  return formatDayMonth(iso);
}

export function endOfLesson(startsAt: string, durationMins: number): string {
  return new Date(new Date(startsAt).getTime() + durationMins * MINUTE).toISOString();
}

export function isFuture(iso: string, now = Date.now()): boolean {
  return new Date(iso).getTime() > now;
}

/** Breaks a duration into whole days, hours, minutes and seconds. */
export function countdownParts(msRemaining: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const clamped = Math.max(0, msRemaining);
  return {
    days: Math.floor(clamped / DAY),
    hours: Math.floor((clamped % DAY) / HOUR),
    minutes: Math.floor((clamped % HOUR) / MINUTE),
    seconds: Math.floor((clamped % MINUTE) / 1000),
  };
}

export function formatDurationLabel(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const hours = mins / 60;
  return hours === 1 ? '1 hour' : `${hours % 1 === 0 ? hours : hours.toFixed(1)} hours`;
}

/** "17:30 – 18:30" */
export function formatTimeRange(startsAt: string, durationMins: number): string {
  return `${formatTime(startsAt)} – ${formatTime(endOfLesson(startsAt, durationMins))}`;
}
