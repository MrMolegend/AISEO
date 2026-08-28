'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarDays, CheckCircle2, MessageSquare, Video } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { DASHBOARD_HOME } from '@/lib/nav';
import { getTutor, subjectName } from '@/lib/queries';
import { formatDurationLabel, formatLongDate, formatTime } from '@/lib/datetime';
import { formatPence } from '@/lib/utils';

/**
 * The screen after a demo booking is created. It reads the booking back out of
 * the store by id, which proves the record really was saved rather than just
 * animating a tick.
 */
export function BookingConfirmation({ bookingId }: { bookingId: string | null }) {
  const { getBooking, hydrated, startConversation, role } = useDemo();
  const reduced = useReducedMotion();
  const router = useRouter();

  const booking = bookingId ? getBooking(bookingId) : undefined;
  const tutor = getTutor(booking?.tutorId);

  if (!hydrated) {
    return (
      <div className="container-narrow py-16">
        <p className="text-ink-subtle text-center text-sm">Loading your booking…</p>
      </div>
    );
  }

  if (!booking || !tutor) {
    return (
      <div className="container-narrow py-16">
        <EmptyState
          icon={<CalendarDays className="size-6" aria-hidden />}
          title="We could not find that booking"
          body="The reference may have expired, or the demo data was reset. Your existing lessons are still in your dashboard."
          action={{ label: 'Find a tutor', href: '/tutors' }}
        />
      </div>
    );
  }

  const dashboard = DASHBOARD_HOME[role ?? 'student'];

  return (
    <div className="container-narrow py-12 sm:py-16">
      <motion.div
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-3">
          <span className="bg-success-bg text-success flex size-11 items-center justify-center rounded-full">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-[1.625rem] tracking-[var(--tracking-tight)]">
              Lesson booked
            </h1>
            <p className="text-ink-subtle mt-0.5 text-sm">
              Reference {booking.reference} · demo booking
            </p>
          </div>
        </div>

        <Card className="mt-7 p-5">
          <div className="flex items-center gap-3.5">
            <Avatar
              firstName={tutor.firstName}
              lastName={tutor.lastName}
              tone={tutor.avatarTone}
              size="lg"
            />
            <div>
              <p className="font-semibold">
                {tutor.firstName} {tutor.lastName}
              </p>
              <p className="text-ink-subtle text-sm">
                {subjectName(booking.subjectId)} · {booking.level}
              </p>
            </div>
          </div>

          <dl className="border-line mt-5 grid gap-3.5 border-t pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink-subtle">Date</dt>
              <dd className="mt-0.5 font-medium">{formatLongDate(booking.startsAt)}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Time</dt>
              <dd className="tabular mt-0.5 font-medium">
                {formatTime(booking.startsAt)} ·{' '}
                {formatDurationLabel(booking.durationMins)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Total</dt>
              <dd className="tabular mt-0.5 font-medium">
                {formatPence(booking.lessonPence + booking.feePence)}
              </dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Payment</dt>
              <dd className="mt-0.5 font-medium">Not taken — demonstration build</dd>
            </div>
          </dl>

          {booking.note && (
            <div className="border-line mt-5 border-t pt-5">
              <p className="text-ink-subtle text-sm">Your note to {tutor.firstName}</p>
              <p className="text-ink-muted mt-1 text-sm leading-relaxed">
                {booking.note}
              </p>
            </div>
          )}
        </Card>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
          <ButtonLink href={dashboard} size="lg">
            Go to dashboard
          </ButtonLink>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => router.push(`/messages/${startConversation(booking.tutorId)}`)}
          >
            <MessageSquare className="size-4" aria-hidden />
            Message tutor
          </Button>
          <ButtonLink href={`/lesson/${booking.id}`} variant="secondary" size="lg">
            <Video className="size-4" aria-hidden />
            View lesson room
          </ButtonLink>
        </div>

        <div className="border-line bg-surface mt-8 rounded-[var(--radius-card)] border p-5">
          <h2 className="text-base font-semibold">What happens next</h2>
          <ol className="text-ink-muted mt-3 space-y-2.5 text-sm">
            <li className="flex gap-2.5">
              <span className="text-brand font-semibold">1.</span>
              {tutor.firstName} sees the booking and can confirm or propose another time.
            </li>
            <li className="flex gap-2.5">
              <span className="text-brand font-semibold">2.</span>
              The lesson appears in your dashboard with a countdown and a join button.
            </li>
            <li className="flex gap-2.5">
              <span className="text-brand font-semibold">3.</span>
              The room opens ten minutes before the start time.
            </li>
          </ol>
          <p className="text-ink-subtle mt-4 text-sm">
            Need to change something?{' '}
            <Link href={dashboard} className="text-brand hover:underline">
              Manage the booking from your lessons list
            </Link>
            .
          </p>
        </div>
      </motion.div>
    </div>
  );
}
