import { describe, expect, it } from 'vitest';
import { earningsSummary, profileCompletion, weeklyEarnings } from '@/lib/tutor-metrics';
import { getSeedBookings, getTutor, getTutors } from '@/lib/queries';
import { canJoin } from '@/lib/booking-status';
import { at } from '@/lib/datetime';
import type { Booking, Tutor } from '@/lib/types';

const complete = getTutor('t-amara') as Tutor;

describe('profileCompletion', () => {
  it('scores a finished profile at 100 per cent with nothing missing', () => {
    const result = profileCompletion(complete);
    expect(result.percent).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('names what is missing rather than only scoring it', () => {
    const bare: Tutor = {
      ...complete,
      headline: '',
      about: '',
      qualifications: [],
      availability: [],
    };
    const result = profileCompletion(bare);
    expect(result.percent).toBeLessThan(100);
    expect(result.missing).toContain('Add a headline');
    expect(result.missing).toContain('Add a qualification');
    expect(result.missing).toContain('Set your weekly availability');
  });

  it('rates every seeded tutor as publishable', () => {
    for (const tutor of getTutors()) {
      expect(profileCompletion(tutor).percent).toBeGreaterThanOrEqual(90);
    }
  });
});

describe('earningsSummary', () => {
  const bookings = getSeedBookings().filter((booking) => booking.tutorId === 't-priya');

  it('counts completed lessons as available and confirmed ones as pending', () => {
    const summary = earningsSummary(bookings);
    const completed = bookings.filter((booking) => booking.status === 'completed');
    const confirmed = bookings.filter((booking) => booking.status === 'confirmed');

    expect(summary.availablePence).toBe(
      completed.reduce((total, booking) => total + booking.lessonPence, 0),
    );
    expect(summary.pendingPence).toBe(
      confirmed.reduce((total, booking) => total + booking.lessonPence, 0),
    );
  });

  it('excludes the platform fee from what a tutor earns', () => {
    const summary = earningsSummary(bookings);
    const gross = bookings
      .filter((booking) => booking.status === 'completed')
      .reduce((total, booking) => total + booking.lessonPence + booking.feePence, 0);
    expect(summary.availablePence).toBeLessThan(gross);
  });

  it('ignores cancelled and requested lessons entirely', () => {
    const summary = earningsSummary([
      { ...(bookings[0] as Booking), status: 'cancelled' },
      { ...(bookings[0] as Booking), status: 'requested' },
    ]);
    expect(summary.availablePence).toBe(0);
    expect(summary.pendingPence).toBe(0);
  });
});

describe('weeklyEarnings', () => {
  it('returns one bucket per week, oldest first', () => {
    const buckets = weeklyEarnings(getSeedBookings(), 8);
    expect(buckets).toHaveLength(8);
    expect(buckets[7]?.label).toBe('This week');
  });

  it('never returns a negative total', () => {
    for (const bucket of weeklyEarnings(getSeedBookings(), 8)) {
      expect(bucket.pence).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('canJoin', () => {
  const start = at(0, 12);
  const startMs = Date.parse(start);

  it('opens the room ten minutes before the lesson', () => {
    expect(canJoin(start, 60, startMs - 11 * 60_000)).toBe(false);
    expect(canJoin(start, 60, startMs - 9 * 60_000)).toBe(true);
  });

  it('stays open until the lesson has finished', () => {
    expect(canJoin(start, 60, startMs + 59 * 60_000)).toBe(true);
    expect(canJoin(start, 60, startMs + 61 * 60_000)).toBe(false);
  });
});
