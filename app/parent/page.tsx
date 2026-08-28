'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MessageSquare, ShieldCheck, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { LessonCard } from '@/components/dashboard/lesson-card';
import { LearnerSwitcher } from '@/components/parent/learner-switcher';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { getLearners, getProgressFor, getTutor, subjectName } from '@/lib/queries';
import { formatDayMonth, formatRelativeDay } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';

export default function ParentOverviewPage() {
  const { account, bookings, conversations, hydrated } = useDemo();
  const [learnerId, setLearnerId] = useState('');

  if (!hydrated || !account) return <Skeleton className="h-96 w-full" />;

  const learners = getLearners(account.id);
  const mine = bookings.filter((booking) => booking.bookedById === account.id);
  const filtered = learnerId
    ? mine.filter((booking) => booking.learnerId === learnerId)
    : mine;

  const upcoming = filtered.filter((booking) => booking.status === 'confirmed');
  const completed = filtered.filter((booking) => booking.status === 'completed');
  const spend = filtered
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((total, booking) => total + booking.lessonPence + booking.feePence, 0);

  const feedback = completed
    .filter((booking) => booking.tutorFeedback)
    .slice(-3)
    .reverse();

  const threads = conversations.filter(
    (conversation) => conversation.memberId === account.id,
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hello, ${account.firstName}`}
        lead="Lessons, tutors and progress for the learners linked to your account."
        action={<ButtonLink href="/tutors">Book a lesson</ButtonLink>}
      />

      <LearnerSwitcher
        learners={learners}
        value={learnerId}
        onChange={setLearnerId}
        allowAll
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Linked learners"
          value={String(learners.length)}
          hint={learners.map((learner) => learner.firstName).join(' and ')}
          icon={<ShieldCheck className="size-4" aria-hidden />}
          tone="brand"
        />
        <StatCard
          label="Upcoming lessons"
          value={String(upcoming.length)}
          hint={upcoming[0] ? formatRelativeDay(upcoming[0].startsAt) : 'Nothing booked'}
          icon={<CalendarDays className="size-4" aria-hidden />}
        />
        <StatCard
          label="Lessons completed"
          value={String(completed.length)}
          hint="Across the selected learners"
          tone="mint"
        />
        <StatCard
          label="Spend to date"
          value={formatPence(spend)}
          hint="Demo figures — no payments are taken"
          icon={<Wallet className="size-4" aria-hidden />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming lessons</CardTitle>
              <ButtonLink href="/parent/lessons" variant="ghost" size="sm">
                See all
              </ButtonLink>
            </CardHeader>
            <CardBody className="space-y-3">
              {upcoming.length === 0 ? (
                <EmptyState
                  icon={<CalendarDays className="size-6" aria-hidden />}
                  title="Nothing booked"
                  body="Find a tutor for the subject your child needs and book a time that works around school."
                  action={{ label: 'Find a tutor', href: '/tutors' }}
                />
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
              <CardTitle>Recent tutor feedback</CardTitle>
              <ButtonLink href="/parent/progress" variant="ghost" size="sm">
                Progress
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {feedback.length === 0 ? (
                <p className="text-ink-subtle py-4 text-center text-sm">
                  Tutors add a short note after each lesson. They will appear here.
                </p>
              ) : (
                <ul className="divide-line divide-y">
                  {feedback.map((booking) => {
                    const tutor = getTutor(booking.tutorId);
                    return (
                      <li key={booking.id} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">
                            {subjectName(booking.subjectId)} ·{' '}
                            {tutor ? `${tutor.firstName} ${tutor.lastName}` : 'Tutor'}
                          </p>
                          <span className="text-ink-subtle text-xs">
                            {formatDayMonth(booking.startsAt)}
                          </span>
                        </div>
                        <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                          {booking.tutorFeedback}
                        </p>
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
              <CardTitle>Learners</CardTitle>
              <ButtonLink href="/parent/learners" variant="ghost" size="sm">
                Manage
              </ButtonLink>
            </CardHeader>
            <CardBody>
              <ul className="divide-line divide-y">
                {learners.map((learner) => {
                  const progress = getProgressFor(learner.id);
                  const average = progress.length
                    ? Math.round(
                        progress.reduce((total, entry) => total + entry.confidence, 0) /
                          progress.length,
                      )
                    : 0;
                  return (
                    <li key={learner.id} className="py-3.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Avatar
                          firstName={learner.firstName}
                          lastName={learner.lastName}
                          tone={learner.avatarTone}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">
                            {learner.firstName} {learner.lastName}
                          </p>
                          <p className="text-ink-subtle text-xs">
                            {learner.yearGroup} · {learner.level}
                          </p>
                        </div>
                        <Badge tone="mint">{average}%</Badge>
                      </div>
                      <ProgressBar
                        value={average}
                        label={`${learner.firstName}'s progress towards their goal`}
                        tone="mint"
                        className="mt-2.5"
                      />
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Messages with tutors</CardTitle>
              <ButtonLink href="/parent/messages" variant="ghost" size="sm">
                Open
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {threads.length === 0 ? (
                <p className="text-ink-subtle text-sm">No conversations yet.</p>
              ) : (
                <ul className="divide-line divide-y">
                  {threads.slice(0, 3).map((conversation) => {
                    const tutor = getTutor(conversation.tutorId);
                    const last = conversation.messages[conversation.messages.length - 1];
                    return (
                      <li key={conversation.id}>
                        <Link
                          href={`/parent/messages/${conversation.id}`}
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
              <CardTitle>What you can see</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-ink-muted text-sm leading-relaxed">
                As an authorised parent you can see lessons, tutors, spending and the
                feedback tutors write. You do not see your child’s private messages with a
                tutor unless the conversation is on your own account — the two are kept
                separate on purpose.
              </p>
              <p className="text-ink-subtle mt-3 text-sm">
                {learners.length} {pluralise(learners.length, 'learner')} linked to this
                account.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
