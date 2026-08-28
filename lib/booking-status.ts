import type { BookingStatus } from '@/lib/types';

/** Label and badge tone for every booking status, in one place. */
export const BOOKING_STATUS: Record<
  BookingStatus,
  { label: string; tone: 'neutral' | 'brand' | 'mint' | 'success' | 'warning' | 'danger' }
> = {
  requested: { label: 'Awaiting tutor', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'mint' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  'reschedule-requested': { label: 'Reschedule requested', tone: 'warning' },
};

/** The room opens ten minutes before the start and closes at the end. */
export function canJoin(
  startsAt: string,
  durationMins: number,
  now = Date.now(),
): boolean {
  const start = new Date(startsAt).getTime();
  return now >= start - 10 * 60_000 && now <= start + durationMins * 60_000;
}
