'use client';

import { Video } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button, ButtonLink } from '@/components/ui/button';
import { useNow } from '@/lib/use-now';
import { canJoin } from '@/lib/booking-status';
import { getTutor, subjectName } from '@/lib/queries';
import { countdownParts, formatLongDate, formatTimeRange } from '@/lib/datetime';
import type { Booking } from '@/lib/types';

/**
 * The one thing a student opens the dashboard to see. The countdown only starts
 * after mount — a ticking clock rendered on the server would never match the
 * client — and the join button unlocks ten minutes before the start.
 */
export function NextLessonCard({ booking }: { booking: Booking }) {
  const tutor = getTutor(booking.tutorId);
  const now = useNow(1000);

  const start = new Date(booking.startsAt).getTime();
  const remaining = now === null ? null : start - now;
  const joinable = now !== null && canJoin(booking.startsAt, booking.durationMins, now);

  return (
    <div className="surface-navy-gradient border-navy-line rounded-[var(--radius-panel)] border p-5 sm:p-6">
      <p className="text-mint-line text-sm font-medium">Your next lesson</p>

      <div className="mt-4 flex flex-wrap items-start gap-x-5 gap-y-4">
        <div className="min-w-56 flex-1">
          <h2 className="text-xl text-white">
            {subjectName(booking.subjectId)} · {booking.level}
          </h2>
          {tutor && (
            <div className="mt-3 flex items-center gap-2.5">
              <Avatar
                firstName={tutor.firstName}
                lastName={tutor.lastName}
                tone={tutor.avatarTone}
                size="sm"
              />
              <p className="text-sm text-white/80">
                with {tutor.firstName} {tutor.lastName}
              </p>
            </div>
          )}
          <p className="tabular mt-3 text-sm text-white/70">
            {formatLongDate(booking.startsAt)} ·{' '}
            {formatTimeRange(booking.startsAt, booking.durationMins)}
          </p>
        </div>

        <div className="border-navy-line rounded-[var(--radius-card)] border bg-white/5 px-4 py-3">
          <p className="text-xs text-white/60">
            {remaining !== null && remaining <= 0 ? 'In progress' : 'Starts in'}
          </p>
          <p className="tabular mt-1 text-xl font-semibold text-white" aria-live="off">
            {remaining === null ? '—' : formatCountdown(remaining)}
          </p>
        </div>
      </div>

      {booking.objectives && booking.objectives.length > 0 && (
        <div className="border-navy-line mt-5 border-t pt-4">
          <p className="text-xs font-medium text-white/60">What you agreed to cover</p>
          <ul className="mt-2 space-y-1.5">
            {booking.objectives.map((objective) => (
              <li key={objective} className="flex gap-2 text-sm text-white/80">
                <span className="text-mint-line" aria-hidden>
                  •
                </span>
                {objective}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        {joinable ? (
          <ButtonLink href={`/lesson/${booking.id}`} size="lg">
            <Video className="size-4" aria-hidden />
            Join lesson
          </ButtonLink>
        ) : (
          <Button size="lg" disabled title="The room opens ten minutes before the start">
            <Video className="size-4" aria-hidden />
            Room opens 10 minutes before
          </Button>
        )}
        <ButtonLink
          href={`/lesson/${booking.id}`}
          variant="secondary"
          size="lg"
          className="border-navy-line bg-white/5 text-white hover:bg-white/10"
        >
          Check camera and microphone
        </ButtonLink>
      </div>
    </div>
  );
}

function formatCountdown(ms: number): string {
  const { days, hours, minutes, seconds } = countdownParts(Math.abs(ms));
  if (ms < 0) return 'now';
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}
