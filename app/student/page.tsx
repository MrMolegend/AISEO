'use client';

import Link from 'next/link';
import {
  CalendarDays,
  CalendarPlus,
  Heart,
  MessageSquare,
  Search,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { NextLessonCard } from '@/components/dashboard/next-lesson';
import { LessonCard } from '@/components/dashboard/lesson-card';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { ProgressBar } from '@/components/ui/progress';
import { TutorCard } from '@/components/tutors/tutor-card';
import { useDemo } from '@/lib/store/demo-store';
import { useNow } from '@/lib/use-now';
import {
  getProgressFor,
  getRecommendedTutors,
  getTutor,
  subjectName,
} from '@/lib/queries';
import { formatMessageStamp } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';

export default function StudentOverviewPage() {
  const { account, bookings, conversations, favourites, tutors, hydrated } = useDemo();
  const now = useNow();

  if (!hydrated || !account || now === null) return <DashboardSkeleton />;

  const mine = bookings.filter((booking) => booking.bookedById === account.id);
  const upcoming = mine.filter(
    (booking) =>
      booking.status !== 'cancelled' &&
      booking.status !== 'completed' &&
      new Date(booking.startsAt).getTime() > now - 60 * 60_000,
  );
  const completed = mine.filter((booking) => booking.status === 'completed');
  const next = upcoming[0];

  const threads = conversations
    .filter((conversation) => conversation.memberId === account.id)
    .slice(0, 3);

  const saved = favourites
    .map((id) => tutors.find((tutor) => tutor.id === id))
    .filter((tutor): tutor is NonNullable<typeof tutor> => Boolean(tutor));

  const progress = getProgressFor(account.id);
  const recommended = getRecommendedTutors(
    account.subjects,
    mine.map((booking) => booking.tutorId),
    3,
  );

  const spend = mine
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((total, booking) => total + booking.lessonPence + booking.feePence, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`${greeting(now)}, ${account.firstName}`}
        lead={
          next
            ? 'Here is what is coming up and where you left off.'
            : 'Nothing is booked at the moment — find a tutor when you are ready.'
        }
        action={
          <ButtonLink href="/tutors">
            <Search className="size-4" aria-hidden />
            Find a tutor
          </ButtonLink>
        }
      />

      {next ? (
        <NextLessonCard booking={next} />
      ) : (
        <EmptyState
          icon={<CalendarDays className="size-6" aria-hidden />}
          title="No lessons booked"
          body="When you book a lesson it appears here with a countdown and a join button."
          action={{ label: 'Browse tutors', href: '/tutors' }}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Upcoming lessons"
          value={String(upcoming.length)}
          hint={upcoming.length ? 'Across all your subjects' : 'Nothing booked yet'}
          icon={<CalendarDays className="size-4" aria-hidden />}
          tone="brand"
        />
        <StatCard
          label="Lessons completed"
          value={String(completed.length)}
          hint="Since you joined Tutor Hub"
          icon={<TrendingUp className="size-4" aria-hidden />}
          tone="mint"
        />
        <StatCard
          label="Saved tutors"
          value={String(saved.length)}
          hint="Shortlisted for later"
          icon={<Heart className="size-4" aria-hidden />}
        />
        <StatCard
          label="Total booked"
          value={formatPence(spend)}
          hint="Demo figures — no payments are taken"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming lessons</CardTitle>
              <ButtonLink href="/student/lessons" variant="ghost" size="sm">
                See all
              </ButtonLink>
            </CardHeader>
            <CardBody className="space-y-3">
              {upcoming.length === 0 ? (
                <p className="text-ink-subtle py-4 text-center text-sm">
                  Nothing scheduled. Book a lesson and it will show up here.
                </p>
              ) : (
                upcoming
                  .slice(0, 3)
                  .map((booking) => (
                    <LessonCard
                      key={booking.id}
                      booking={booking}
                      perspective="learner"
                    />
                  ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent lessons</CardTitle>
              <ButtonLink href="/student/lessons?tab=completed" variant="ghost" size="sm">
                Booking history
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {completed.length === 0 ? (
                <p className="text-ink-subtle py-4 text-center text-sm">
                  Completed lessons and tutor feedback will appear here.
                </p>
              ) : (
                <ul className="divide-line divide-y">
                  {completed
                    .slice(-3)
                    .reverse()
                    .map((booking) => {
                      const tutor = getTutor(booking.tutorId);
                      return (
                        <li
                          key={booking.id}
                          className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          {tutor && (
                            <Avatar
                              firstName={tutor.firstName}
                              lastName={tutor.lastName}
                              tone={tutor.avatarTone}
                              size="sm"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {subjectName(booking.subjectId)} with {tutor?.firstName}
                            </p>
                            {booking.tutorFeedback && (
                              <p className="text-ink-subtle mt-1 line-clamp-2 text-sm leading-relaxed">
                                {booking.tutorFeedback}
                              </p>
                            )}
                          </div>
                          <span className="text-ink-subtle shrink-0 text-xs">
                            {formatMessageStamp(booking.startsAt)}
                          </span>
                        </li>
                      );
                    })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <ButtonLink href="/messages" variant="ghost" size="sm">
                Open
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {threads.length === 0 ? (
                <p className="text-ink-subtle py-4 text-center text-sm">
                  No conversations yet.
                </p>
              ) : (
                <ul className="divide-line divide-y">
                  {threads.map((conversation) => {
                    const tutor = getTutor(conversation.tutorId);
                    const last = conversation.messages[conversation.messages.length - 1];
                    return (
                      <li key={conversation.id}>
                        <Link
                          href={`/messages/${conversation.id}`}
                          className="flex items-start gap-3 py-3 first:pt-0"
                        >
                          {tutor && (
                            <Avatar
                              firstName={tutor.firstName}
                              lastName={tutor.lastName}
                              tone={tutor.avatarTone}
                              size="sm"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">
                              {tutor?.firstName} {tutor?.lastName}
                            </span>
                            <span className="text-ink-subtle line-clamp-1 block text-sm">
                              {last?.body ?? 'No messages yet'}
                            </span>
                          </span>
                          {last && (
                            <span className="text-ink-subtle shrink-0 text-xs">
                              {formatMessageStamp(last.sentAt)}
                            </span>
                          )}
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
              <CardTitle>Progress</CardTitle>
              <ButtonLink href="/student/progress" variant="ghost" size="sm">
                Details
              </ButtonLink>
            </CardHeader>
            <CardBody className="space-y-4">
              {progress.length === 0 ? (
                <p className="text-ink-subtle text-sm">
                  Progress appears once you have had a few lessons.
                </p>
              ) : (
                progress.map((entry) => (
                  <div key={entry.subjectId}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">
                        {subjectName(entry.subjectId)}
                      </p>
                      <p className="text-ink-subtle tabular text-xs">
                        {entry.confidence}% towards goal
                      </p>
                    </div>
                    <ProgressBar
                      value={entry.confidence}
                      label={`${subjectName(entry.subjectId)} progress`}
                      tone="mint"
                    />
                    <p className="text-ink-subtle mt-1.5 text-xs">
                      {entry.lessonsCompleted}{' '}
                      {pluralise(entry.lessonsCompleted, 'lesson')} completed
                    </p>
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Saved tutors</CardTitle>
              <ButtonLink href="/student/saved" variant="ghost" size="sm">
                See all
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {saved.length === 0 ? (
                <p className="text-ink-subtle text-sm leading-relaxed">
                  Tap the heart on any tutor to shortlist them. Your list is saved on this
                  device.
                </p>
              ) : (
                <ul className="divide-line divide-y">
                  {saved.slice(0, 4).map((tutor) => (
                    <li key={tutor.id}>
                      <Link
                        href={`/tutors/${tutor.slug}`}
                        className="flex items-center gap-3 py-3 first:pt-0"
                      >
                        <Avatar
                          firstName={tutor.firstName}
                          lastName={tutor.lastName}
                          tone={tutor.avatarTone}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {tutor.firstName} {tutor.lastName}
                          </span>
                          <span className="text-ink-subtle block text-xs">
                            {subjectName(tutor.subjects[0])} ·{' '}
                            {formatPence(tutor.hourlyRate)}/hr
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-2">
              <ButtonLink href="/tutors" variant="secondary" block>
                <Search className="size-4" aria-hidden />
                Find a tutor
              </ButtonLink>
              <ButtonLink href="/messages" variant="secondary" block>
                <MessageSquare className="size-4" aria-hidden />
                Open messages
              </ButtonLink>
              <ButtonLink href="/student/lessons" variant="secondary" block>
                <CalendarPlus className="size-4" aria-hidden />
                Manage lessons
              </ButtonLink>
            </CardBody>
          </Card>
        </div>
      </div>

      <section aria-labelledby="recommended-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="recommended-heading" className="text-xl">
              Because you study{' '}
              {(account.subjects ?? []).map((id) => subjectName(id)).join(' and ')}
            </h2>
            <p className="text-ink-subtle mt-1 text-sm">
              Tutors who teach your subjects at {account.level ?? 'your'} level.
            </p>
          </div>
          <ButtonLink href="/tutors" variant="secondary" size="sm">
            See more
          </ButtonLink>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {recommended.map((tutor) => (
            <TutorCard key={tutor.id} tutor={tutor} />
          ))}
        </div>
      </section>
    </div>
  );
}

function greeting(now: number): string {
  const hour = new Date(now).getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-48 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}
