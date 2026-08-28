import { FEE_RATE } from '@/lib/data/bookings';
import { formatDurationLabel } from '@/lib/datetime';

export { formatPence } from '@/lib/utils';

/** Lesson price in pence for a given hourly rate and length. */
export function lessonPenceFor(hourlyRate: number, durationMins: number): number {
  return Math.round((hourlyRate * durationMins) / 60);
}

/** Tutor Hub's service fee, rounded to the nearest 10p. */
export function feePenceFor(lessonPence: number): number {
  return Math.round((lessonPence * FEE_RATE) / 10) * 10;
}

export function formatDurationLabelSafe(mins: number): string {
  return formatDurationLabel(mins);
}

export const DURATION_OPTIONS = [
  { value: 45, label: '45 minutes', note: 'A focused single topic' },
  { value: 60, label: '60 minutes', note: 'The usual choice' },
  { value: 90, label: '90 minutes', note: 'Best for practicals and past papers' },
];
