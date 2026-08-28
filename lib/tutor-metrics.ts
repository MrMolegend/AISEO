import type { Booking, Tutor } from '@/lib/types';

/**
 * How complete a tutor's public profile is.
 *
 * The weights are deliberately blunt: each field either helps a student decide
 * or it does not. The list is returned alongside the score so the editor can
 * say exactly what is missing rather than showing a bare percentage.
 */
export function profileCompletion(tutor: Tutor): {
  percent: number;
  missing: string[];
} {
  const checks: { label: string; done: boolean }[] = [
    { label: 'Add a headline', done: tutor.headline.trim().length > 20 },
    { label: 'Write an about section', done: tutor.about.trim().length > 80 },
    {
      label: 'Describe your teaching approach',
      done: tutor.teachingApproach.trim().length > 80,
    },
    { label: 'Choose at least one subject', done: tutor.subjects.length > 0 },
    { label: 'Choose the levels you teach', done: tutor.levels.length > 0 },
    { label: 'Set an hourly rate', done: tutor.hourlyRate > 0 },
    { label: 'Add a qualification', done: tutor.qualifications.length > 0 },
    { label: 'Add your experience', done: tutor.experience.length > 0 },
    { label: 'Set your weekly availability', done: tutor.availability.length > 0 },
    { label: 'Add your lesson policies', done: tutor.policies.length > 0 },
  ];

  const done = checks.filter((check) => check.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((check) => !check.done).map((check) => check.label),
  };
}

/** Earnings for a tutor, split the way a payout statement would be. */
export function earningsSummary(
  bookings: Booking[],
  now = Date.now(),
): {
  availablePence: number;
  pendingPence: number;
  thisWeekPence: number;
  lessonsThisWeek: number;
  completed: Booking[];
} {
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const completed = bookings.filter((booking) => booking.status === 'completed');
  const upcoming = bookings.filter((booking) => booking.status === 'confirmed');

  const thisWeek = completed.filter(
    (booking) => new Date(booking.startsAt).getTime() >= weekAgo,
  );

  return {
    availablePence: completed.reduce((total, booking) => total + booking.lessonPence, 0),
    pendingPence: upcoming.reduce((total, booking) => total + booking.lessonPence, 0),
    thisWeekPence: thisWeek.reduce((total, booking) => total + booking.lessonPence, 0),
    lessonsThisWeek: thisWeek.length,
    completed,
  };
}

/** Totals by ISO week label, newest last — the shape the earnings chart wants. */
export function weeklyEarnings(
  bookings: Booking[],
  weeks = 8,
  now = Date.now(),
): { label: string; pence: number }[] {
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const buckets: { label: string; pence: number }[] = [];

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const end = now - index * WEEK;
    const start = end - WEEK;
    const pence = bookings
      .filter((booking) => booking.status === 'completed')
      .filter((booking) => {
        const time = new Date(booking.startsAt).getTime();
        return time >= start && time < end;
      })
      .reduce((total, booking) => total + booking.lessonPence, 0);
    buckets.push({ label: index === 0 ? 'This week' : `${index}w ago`, pence });
  }

  return buckets;
}
