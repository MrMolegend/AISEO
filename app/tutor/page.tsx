'use client';

import Link from 'next/link';
import { CalendarClock, Clock4, Inbox, MessageSquare, Star, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { LessonCard } from '@/components/dashboard/lesson-card';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { Rating } from '@/components/ui/rating';
import { Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { earningsSummary, profileCompletion } from '@/lib/tutor-metrics';
import {
  bookingLearnerName,
  getAccount,
  getLearner,
  getReviewsForTutor,
  subjectName,
} from '@/lib/queries';
import { WEEKDAYS } from '@/lib/availability';
import { formatDayMonth, formatRelativeDay, formatTimeRange } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';

export default function TutorOverviewPage() {
  const { account, tutors, bookings, conversations, hydrated, getAvailability } =
    useDemo();

  if (!hydrated || !account?.tutorId) return <Skeleton className="h-96 w-full" />;

  const tutor = tutors.find((item) => item.id === account.tutorId);
  if (!tutor) return <Skeleton className="h-96 w-full" />;

  const mine = bookings.filter((booking) => booking.tutorId === tutor.id);
  const today = mine.filter(
    (booking) =>
      booking.status === 'confirmed' &&
      booking.startsAt.slice(0, 10) === new Date().toISOString().slice(0, 10),
  );
  const upcoming = mine.filter((booking) => booking.status === 'confirmed');
  const requests = mine.filter(
    (booking) =>
      booking.status === 'requested' || booking.status === 'reschedule-requested',
  );
  const threads = conversations.filter(
    (conversation) => conversation.tutorId === tutor.id,
  );
  const reviews = getReviewsForTutor(tutor.id).slice(0, 3);
  const earnings = earningsSummary(mine);
  const completion = profileCompletion(tutor);
  const slots = getAvailability(tutor.id);

  const students = new Set(mine.map((booking) => bookingLearnerName(booking)));

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good to see you, ${tutor.firstName}`}
        lead={
          requests.length
            ? `${requests.length} ${pluralise(requests.length, 'request')} waiting on you, and ${today.length} ${pluralise(today.length, 'lesson')} today.`
            : `${today.length} ${pluralise(today.length, 'lesson')} today.`
        }
        action={
          <ButtonLink href="/tutor/availability" variant="secondary">
            <Clock4 className="size-4" aria-hidden />
            Edit availability
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lessons today"
          value={String(today.length)}
          hint={
            today[0]
              ? `First at ${formatTimeRange(today[0].startsAt, today[0].durationMins)}`
              : 'Nothing scheduled'
          }
          icon={<CalendarClock className="size-4" aria-hidden />}
          tone="brand"
        />
        <StatCard
          label="Open requests"
          value={String(requests.length)}
          hint={
            requests.length
              ? 'Reply within a day to keep your response time'
              : 'All caught up'
          }
          icon={<Inbox className="size-4" aria-hidden />}
          tone={requests.length ? 'warning' : 'default'}
        />
        <StatCard
          label="Earned this week"
          value={formatPence(earnings.thisWeekPence)}
          hint={`${earnings.lessonsThisWeek} ${pluralise(earnings.lessonsThisWeek, 'lesson')} completed · demo figures`}
          icon={<Wallet className="size-4" aria-hidden />}
          tone="mint"
        />
        <StatCard
          label="Rating"
          value={tutor.rating.toFixed(1)}
          hint={`${tutor.reviewCount} reviews · ${tutor.lessonsCompleted} lessons taught`}
          icon={<Star className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Booking requests</CardTitle>
              <ButtonLink href="/tutor/lessons" variant="ghost" size="sm">
                All lessons
              </ButtonLink>
            </CardHeader>
            <CardBody className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-ink-subtle py-4 text-center text-sm">
                  No requests waiting. New ones appear here and in your notifications.
                </p>
              ) : (
                requests.map((booking) => (
                  <LessonCard key={booking.id} booking={booking} perspective="tutor" />
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today and next</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-ink-subtle py-4 text-center text-sm">
                  Nothing booked. Check your availability is up to date.
                </p>
              ) : (
                upcoming
                  .slice(0, 3)
                  .map((booking) => (
                    <LessonCard key={booking.id} booking={booking} perspective="tutor" />
                  ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent reviews</CardTitle>
              <ButtonLink href={`/tutors/${tutor.slug}`} variant="ghost" size="sm">
                View public profile
              </ButtonLink>
            </CardHeader>
            <CardBody>
              <ul className="divide-line divide-y">
                {reviews.map((review) => (
                  <li key={review.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{review.authorName}</p>
                      <Rating value={review.rating} showCount={false} size="sm" />
                    </div>
                    <p className="text-ink-muted mt-1.5 line-clamp-2 text-sm leading-relaxed">
                      {review.body}
                    </p>
                    <p className="text-ink-subtle mt-1.5 text-xs">
                      {review.subject} {review.level} · {formatDayMonth(review.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile completion</CardTitle>
              <span className="tabular text-sm font-semibold">{completion.percent}%</span>
            </CardHeader>
            <CardBody className="space-y-3">
              <ProgressBar
                value={completion.percent}
                label="Profile completion"
                tone={completion.percent === 100 ? 'mint' : 'brand'}
              />
              {completion.missing.length === 0 ? (
                <p className="text-ink-subtle text-sm">
                  Your profile has everything a student needs to decide.
                </p>
              ) : (
                <ul className="text-ink-muted space-y-1.5 text-sm">
                  {completion.missing.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-warning" aria-hidden>
                        •
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              )}
              <ButtonLink href="/tutor/profile" variant="secondary" block>
                Edit profile
              </ButtonLink>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>This week</CardTitle>
              <ButtonLink href="/tutor/availability" variant="ghost" size="sm">
                Edit
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {slots.length === 0 ? (
                <p className="text-ink-subtle text-sm">
                  No availability set — students cannot book you until you add some hours.
                </p>
              ) : (
                <ul className="space-y-2">
                  {WEEKDAYS.map((day) => {
                    const daySlots = slots.filter((slot) => slot.day === day.value);
                    return (
                      <li
                        key={day.value}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-ink-subtle w-20 shrink-0">{day.label}</span>
                        {daySlots.length === 0 ? (
                          <span className="text-ink-subtle text-xs">Not available</span>
                        ) : (
                          <span className="flex flex-wrap justify-end gap-1.5">
                            {daySlots.map((slot) => (
                              <Badge key={slot.id} tone="mint">
                                {slot.start}–{slot.end}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <ButtonLink href="/tutor/messages" variant="ghost" size="sm">
                Open
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {threads.length === 0 ? (
                <p className="text-ink-subtle text-sm">No conversations yet.</p>
              ) : (
                <ul className="divide-line divide-y">
                  {threads.slice(0, 3).map((conversation) => {
                    const last = conversation.messages[conversation.messages.length - 1];
                    const name = bookingLearnerNameFor(
                      conversation.memberId,
                      conversation.learnerId,
                    );
                    return (
                      <li key={conversation.id}>
                        <Link
                          href={`/tutor/messages/${conversation.id}`}
                          className="flex items-start gap-3 py-3 first:pt-0"
                        >
                          <Avatar
                            firstName={name.split(' ')[0] ?? ''}
                            lastName={name.split(' ')[1] ?? ''}
                            tone={2}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{name}</span>
                            <span className="text-ink-subtle line-clamp-1 block text-sm">
                              {last?.body ?? 'No messages yet'}
                            </span>
                          </span>
                          <MessageSquare
                            className="text-ink-subtle size-4 shrink-0"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Students</CardTitle>
              <ButtonLink href="/tutor/students" variant="ghost" size="sm">
                See all
              </ButtonLink>
            </CardHeader>
            <CardBody>
              <p className="text-ink-muted text-sm leading-relaxed">
                You have taught {students.size} {pluralise(students.size, 'student')}{' '}
                through Tutor Hub, across{' '}
                {new Set(mine.map((booking) => subjectName(booking.subjectId))).size}{' '}
                subjects. The next lesson is{' '}
                {upcoming[0]
                  ? formatRelativeDay(upcoming[0].startsAt).toLowerCase()
                  : 'not booked yet'}
                .
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** Conversations name the learner where there is one, otherwise the account. */
function bookingLearnerNameFor(memberId: string, learnerId?: string): string {
  const learner = getLearner(learnerId);
  if (learner) return `${learner.firstName} ${learner.lastName}`;
  const account = getAccount(memberId);
  return account ? `${account.firstName} ${account.lastName}` : 'Student';
}
