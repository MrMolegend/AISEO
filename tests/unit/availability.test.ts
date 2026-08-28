import { describe, expect, it } from 'vitest';
import { firstAvailable, generateSlots } from '@/lib/availability';
import { DAY, todayUtc } from '@/lib/datetime';
import type { AvailabilitySlot } from '@/lib/types';

/** A single block every day of the week, so the maths is easy to reason about. */
const everyDay: AvailabilitySlot[] = Array.from({ length: 7 }, (_, day) => ({
  id: `slot-${day}`,
  day,
  start: '09:00',
  end: '13:00',
}));

// Midnight tomorrow, so nothing is filtered out for being in the past.
const now = todayUtc() - DAY;

describe('generateSlots', () => {
  it('produces one entry per day requested', () => {
    expect(generateSlots({ availability: everyDay, days: 5, now })).toHaveLength(5);
  });

  it('offers hourly starts that finish inside the block', () => {
    const [day] = generateSlots({
      availability: everyDay,
      days: 1,
      durationMins: 60,
      now,
    });
    // 09:00–13:00 fits four 60-minute lessons.
    expect(day?.times).toHaveLength(4);
  });

  it('offers fewer starts for a longer lesson', () => {
    const [day] = generateSlots({
      availability: everyDay,
      days: 1,
      durationMins: 90,
      now,
    });
    // 09:00, 10:00 and 11:00 all finish by 13:00; 12:00 would overrun.
    expect(day?.times).toHaveLength(3);
  });

  it('returns no times on a day the tutor does not teach', () => {
    const mondayOnly: AvailabilitySlot[] = [
      { id: 'a', day: 1, start: '16:00', end: '18:00' },
    ];
    const week = generateSlots({ availability: mondayOnly, days: 7, now });
    const withTimes = week.filter((day) => day.times.length > 0);
    expect(withTimes).toHaveLength(1);
  });

  it('drops dates the tutor has blocked out', () => {
    const week = generateSlots({ availability: everyDay, days: 3, now });
    const blocked = week[1]?.dateKey ?? '';

    const after = generateSlots({
      availability: everyDay,
      days: 3,
      unavailableDates: [blocked],
      now,
    });
    expect(after[1]?.times).toHaveLength(0);
    expect(after[0]?.times.length).toBeGreaterThan(0);
  });

  it('never offers a time in the past or inside the notice period', () => {
    const later = todayUtc() + 11 * 60 * 60 * 1000;
    const [day] = generateSlots({
      availability: everyDay,
      days: 1,
      now: later,
      minNoticeHours: 0,
    });
    // 09:00 and 10:00 have already gone by 11:00.
    expect(day?.times).toHaveLength(2);
  });

  it('honours the minimum notice period', () => {
    const [withNotice] = generateSlots({
      availability: everyDay,
      days: 1,
      now: todayUtc(),
      minNoticeHours: 10,
    });
    expect(withNotice?.times).toHaveLength(3);
  });

  it('returns times in chronological order', () => {
    const [day] = generateSlots({ availability: everyDay, days: 1, now });
    const times = day?.times ?? [];
    expect([...times].sort()).toEqual(times);
  });
});

describe('firstAvailable', () => {
  it('finds the first free time across the days given', () => {
    const slots = generateSlots({ availability: everyDay, days: 3, now });
    expect(firstAvailable(slots)).toBe(slots[0]?.times[0]);
  });

  it('is undefined when nothing is free', () => {
    expect(
      firstAvailable(generateSlots({ availability: [], days: 5, now })),
    ).toBeUndefined();
  });
});
