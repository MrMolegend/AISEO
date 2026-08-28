import { describe, expect, it } from 'vitest';
import {
  countdownParts,
  formatDate,
  formatDayMonth,
  formatDurationLabel,
  formatLongDate,
  formatMessageStamp,
  formatRelativeDay,
  formatRelativeTime,
  formatTime,
  formatTimeRange,
  at,
} from '@/lib/datetime';
import { formatPence, formatPounds, formatNumber, formatResponseTime } from '@/lib/utils';

const SUNDAY = '2026-08-30T17:30:00.000Z';

describe('date formatting', () => {
  it('formats dates without relying on the platform ICU data', () => {
    // Node and the browser disagree on Intl's separators, which is why these
    // strings are composed by hand. Locking the exact output keeps it that way.
    expect(formatDate(SUNDAY)).toBe('Sun 30 Aug');
    expect(formatLongDate(SUNDAY)).toBe('Sunday 30 August');
    expect(formatDayMonth(SUNDAY)).toBe('30 Aug 2026');
    expect(formatTime(SUNDAY)).toBe('17:30');
  });

  it('reads dates in UTC rather than the local zone', () => {
    expect(formatTime('2026-08-30T23:45:00.000Z')).toBe('23:45');
    expect(formatDate('2026-01-01T00:15:00.000Z')).toBe('Thu 1 Jan');
  });

  it('pads hours and minutes', () => {
    expect(formatTime('2026-08-30T09:05:00.000Z')).toBe('09:05');
  });

  it('formats a lesson time range from its duration', () => {
    expect(formatTimeRange(SUNDAY, 90)).toBe('17:30 – 19:00');
    expect(formatTimeRange(SUNDAY, 45)).toBe('17:30 – 18:15');
  });
});

describe('formatRelativeDay', () => {
  it('names today, tomorrow and yesterday', () => {
    expect(formatRelativeDay(at(0, 12))).toBe('Today');
    expect(formatRelativeDay(at(1, 12))).toBe('Tomorrow');
    expect(formatRelativeDay(at(-1, 12))).toBe('Yesterday');
  });

  it('falls back to a short date further out', () => {
    expect(formatRelativeDay(at(9, 12))).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-08-30T12:00:00.000Z');

  it('describes the recent past and near future', () => {
    expect(formatRelativeTime('2026-08-30T11:30:00.000Z', now)).toBe('30 minutes ago');
    expect(formatRelativeTime('2026-08-30T13:00:00.000Z', now)).toBe('in 1 hour');
    expect(formatRelativeTime('2026-08-28T12:00:00.000Z', now)).toBe('2 days ago');
    expect(formatRelativeTime('2026-09-13T12:00:00.000Z', now)).toBe('in 2 weeks');
  });

  it('collapses anything under a minute', () => {
    expect(formatRelativeTime('2026-08-30T12:00:20.000Z', now)).toBe('just now');
  });
});

describe('formatMessageStamp', () => {
  it('shows a time for today and a weekday within the week', () => {
    expect(formatMessageStamp(at(0, 9, 5))).toBe('09:05');
    expect(formatMessageStamp(at(-2, 9))).toMatch(/^[A-Z][a-z]{2}$/);
  });

  it('shows a full date once the message is old', () => {
    expect(formatMessageStamp(at(-30, 9))).toMatch(/\d{4}$/);
  });
});

describe('countdownParts', () => {
  it('splits a duration into days, hours, minutes and seconds', () => {
    const parts = countdownParts(((26 * 60 + 5) * 60 + 9) * 1000);
    expect(parts).toEqual({ days: 1, hours: 2, minutes: 5, seconds: 9 });
  });

  it('clamps a negative duration to zero', () => {
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('formatDurationLabel', () => {
  it('reads naturally at each lesson length', () => {
    expect(formatDurationLabel(45)).toBe('45 min');
    expect(formatDurationLabel(60)).toBe('1 hour');
    expect(formatDurationLabel(90)).toBe('1.5 hours');
    expect(formatDurationLabel(120)).toBe('2 hours');
  });
});

describe('money', () => {
  it('drops the pence when a price is whole pounds', () => {
    expect(formatPence(4800)).toBe('£48');
    expect(formatPence(2200)).toBe('£22');
  });

  it('keeps two decimal places when there are pence', () => {
    expect(formatPence(4850)).toBe('£48.50');
    expect(formatPence(305)).toBe('£3.05');
  });

  it('groups thousands', () => {
    expect(formatPence(123456)).toBe('£1,234.56');
    expect(formatPounds(12000)).toBe('£12,000');
    expect(formatNumber(1240)).toBe('1,240');
  });

  it('handles a negative amount', () => {
    expect(formatPence(-1500)).toBe('-£15');
  });
});

describe('formatResponseTime', () => {
  it('reads as a person would say it', () => {
    expect(formatResponseTime(35)).toBe('35 minutes');
    expect(formatResponseTime(60)).toBe('about an hour');
    expect(formatResponseTime(180)).toBe('about 3 hours');
  });
});
