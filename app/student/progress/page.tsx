'use client';

import { Quote, Target, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { Badge } from '@/components/ui/badge';
import { useDemo } from '@/lib/store/demo-store';
import { getProgressFor, subjectName } from '@/lib/queries';
import { formatDayMonth, formatRelativeDay } from '@/lib/datetime';
import { pluralise } from '@/lib/utils';

export default function StudentProgressPage() {
  const { account, bookings, hydrated } = useDemo();

  if (!hydrated || !account) return <Skeleton className="h-96 w-full" />;

  const progress = getProgressFor(account.id);
  const mine = bookings.filter((booking) => booking.bookedById === account.id);
  const completed = mine.filter((booking) => booking.status === 'completed');
  const perMonth = progress.reduce((total, entry) => total + entry.lessonsPerMonth, 0);

  if (progress.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Progress" />
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden />}
          title="Nothing to show yet"
          body="After a few lessons your tutors' feedback and a summary of what you have covered will appear here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress"
        lead="A light record of what you are working on and what your tutors have said. It is not a grading system — the detail comes from the people teaching you."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Subjects in progress"
          value={String(progress.length)}
          hint={progress.map((entry) => subjectName(entry.subjectId)).join(', ')}
          icon={<Target className="size-4" aria-hidden />}
          tone="brand"
        />
        <StatCard
          label="Lessons completed"
          value={String(
            progress.reduce((total, entry) => total + entry.lessonsCompleted, 0),
          )}
          hint={`${completed.length} booked through Tutor Hub`}
          icon={<TrendingUp className="size-4" aria-hidden />}
          tone="mint"
        />
        <StatCard
          label="Typical frequency"
          value={`${perMonth} a month`}
          hint="Across all subjects"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {progress.map((entry) => (
          <Card key={`${entry.subjectId}-${entry.level}`}>
            <CardHeader>
              <div>
                <CardTitle as="h2">{subjectName(entry.subjectId)}</CardTitle>
                <p className="text-ink-subtle mt-0.5 text-sm">{entry.level}</p>
              </div>
              <Badge tone="mint">
                {entry.lessonsPerMonth} {pluralise(entry.lessonsPerMonth, 'lesson')}/month
              </Badge>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <p className="text-ink-subtle text-sm">Towards your goal</p>
                  <p className="tabular text-sm font-medium">{entry.confidence}%</p>
                </div>
                <ProgressBar
                  value={entry.confidence}
                  label={`${subjectName(entry.subjectId)} progress towards the goal`}
                  tone="mint"
                />
              </div>

              <div className="border-line bg-surface-subtle rounded-[var(--radius-control)] border p-3.5">
                <p className="text-ink-subtle flex items-center gap-1.5 text-xs font-medium">
                  <Target className="size-3.5" aria-hidden />
                  Goal
                </p>
                <p className="text-ink mt-1 text-sm">{entry.goal}</p>
              </div>

              <div>
                <p className="text-ink-subtle flex items-center gap-1.5 text-xs font-medium">
                  <Quote className="size-3.5" aria-hidden />
                  Latest feedback
                </p>
                <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                  {entry.lastFeedback}
                </p>
                <p className="text-ink-subtle mt-2 text-xs">
                  {entry.lastFeedbackBy} · {formatDayMonth(entry.lastFeedbackAt)}
                </p>
              </div>

              <p className="text-ink-subtle border-line border-t pt-3 text-xs">
                {entry.lessonsCompleted} {pluralise(entry.lessonsCompleted, 'lesson')}{' '}
                completed in this subject
              </p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Recent activity</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="divide-line divide-y">
            {mine
              .slice()
              .reverse()
              .slice(0, 6)
              .map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {subjectName(booking.subjectId)} · {booking.level}
                    </p>
                    <p className="text-ink-subtle text-xs">
                      {formatRelativeDay(booking.startsAt)} · {booking.status}
                    </p>
                  </div>
                  <span className="text-ink-subtle shrink-0 text-xs">
                    {booking.reference}
                  </span>
                </li>
              ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
