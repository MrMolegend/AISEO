'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, MessageSquare, Video } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { BOOKING_STATUS, canJoin } from '@/lib/booking-status';
import { bookingLearnerName, getTutor, subjectName } from '@/lib/queries';
import { formatRelativeDay, formatTimeRange } from '@/lib/datetime';
import { formatPence } from '@/lib/utils';
import type { Booking } from '@/lib/types';

/**
 * One booking, seen from either side.
 *
 * `perspective` decides whose name is shown and which actions appear — a tutor
 * accepts requests, a student asks to reschedule.
 */
export function LessonCard({
  booking,
  perspective,
}: {
  booking: Booking;
  perspective: 'learner' | 'tutor';
}) {
  const { setBookingStatus, startConversation } = useDemo();
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState<null | 'cancel' | 'reschedule'>(null);

  const tutor = getTutor(booking.tutorId);
  const status = BOOKING_STATUS[booking.status];
  const joinable =
    booking.status === 'confirmed' && canJoin(booking.startsAt, booking.durationMins);

  const counterpartName =
    perspective === 'learner'
      ? tutor
        ? `${tutor.firstName} ${tutor.lastName}`
        : 'Tutor'
      : bookingLearnerName(booking);

  const [first = '', last = ''] = counterpartName.split(' ');

  return (
    <article className="border-line bg-surface rounded-[var(--radius-card)] border p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <Avatar
          firstName={first}
          lastName={last}
          tone={
            perspective === 'learner'
              ? (tutor?.avatarTone ?? 0)
              : counterpartName.length % 5
          }
          size="md"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="font-semibold">
              {subjectName(booking.subjectId)} · {booking.level}
            </h3>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="text-ink-subtle mt-1 text-sm">
            {perspective === 'learner' ? 'with' : 'for'} {counterpartName}
          </p>
          <p className="text-ink-muted tabular mt-1.5 flex flex-wrap items-center gap-x-2 text-sm">
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            {formatRelativeDay(booking.startsAt)} ·{' '}
            {formatTimeRange(booking.startsAt, booking.durationMins)}
          </p>
          {booking.note && (
            <p className="text-ink-subtle mt-2 text-sm leading-relaxed">
              “{booking.note}”
            </p>
          )}
          {booking.tutorFeedback && (
            <div className="border-line bg-surface-subtle mt-3 rounded-[var(--radius-control)] border p-3">
              <p className="text-ink-subtle text-xs font-medium">
                Feedback from {tutor?.firstName ?? 'the tutor'}
              </p>
              <p className="text-ink-muted mt-1 text-sm leading-relaxed">
                {booking.tutorFeedback}
              </p>
            </div>
          )}
        </div>

        <p className="tabular text-ink shrink-0 text-sm font-semibold">
          {formatPence(booking.lessonPence + booking.feePence)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {joinable && (
          <ButtonLink href={`/lesson/${booking.id}`} size="sm">
            <Video className="size-4" aria-hidden />
            Join lesson
          </ButtonLink>
        )}

        {booking.status === 'requested' && perspective === 'tutor' && (
          <>
            <Button
              size="sm"
              onClick={() => {
                setBookingStatus(booking.id, 'confirmed');
                toast({
                  title: 'Lesson confirmed',
                  description: `${counterpartName} has been notified.`,
                });
              }}
            >
              Accept request
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirming('cancel')}>
              Decline
            </Button>
          </>
        )}

        {booking.status === 'reschedule-requested' && perspective === 'tutor' && (
          <Button
            size="sm"
            onClick={() => {
              setBookingStatus(booking.id, 'confirmed');
              toast({
                title: 'Reschedule accepted',
                description: 'The lesson is confirmed at the requested time.',
              });
            }}
          >
            Accept new time
          </Button>
        )}

        <Button
          size="sm"
          variant="secondary"
          onClick={() => router.push(`/messages/${startConversation(booking.tutorId)}`)}
        >
          <MessageSquare className="size-4" aria-hidden />
          Message
        </Button>

        {perspective === 'learner' && tutor && (
          <ButtonLink href={`/tutors/${tutor.slug}`} size="sm" variant="ghost">
            View tutor
          </ButtonLink>
        )}

        {booking.status === 'confirmed' && perspective === 'learner' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirming('reschedule')}>
              Request reschedule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming('cancel')}>
              Cancel
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirming === 'cancel'}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          setBookingStatus(booking.id, 'cancelled');
          toast({
            title: 'Lesson cancelled',
            description: 'Nothing is charged when you cancel more than 24 hours ahead.',
            tone: 'info',
          });
        }}
        title="Cancel this lesson?"
        body={`This will cancel ${subjectName(booking.subjectId)} on ${formatRelativeDay(booking.startsAt).toLowerCase()}. The other person will be notified.`}
        confirmLabel="Cancel lesson"
        cancelLabel="Keep it"
        destructive
      />

      <ConfirmDialog
        open={confirming === 'reschedule'}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          setBookingStatus(booking.id, 'reschedule-requested');
          toast({
            title: 'Reschedule requested',
            description: `${counterpartName} will suggest a new time.`,
          });
        }}
        title="Ask to move this lesson?"
        body="The tutor will see the request and can propose another time from their availability. The original slot is held until they respond."
        confirmLabel="Request reschedule"
      />
    </article>
  );
}
