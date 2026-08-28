'use client';

import { useState } from 'react';
import { Quote, Target, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { LearnerSwitcher } from '@/components/parent/learner-switcher';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { getLearners, getProgressFor, subjectName } from '@/lib/queries';
import { formatDayMonth } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';

export default function ParentProgressPage() {
  const { account, bookings, hydrated } = useDemo();
  const [learnerId, setLearnerId] = useState('');

  if (!hydrated || !account) return <Skeleton className="h-96 w-full" />;

  const learners = getLearners(account.id);
  const active = learnerId || learners[0]?.id || '';
  const learner = learners.find((item) => item.id === active);
  const progress = getProgressFor(active);
  const theirs = bookings.filter((booking) => booking.learnerId === active);
  const completed = theirs.filter((booking) => booking.status === 'completed');
  const spend = theirs
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((total, booking) => total + booking.lessonPence + booking.feePence, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progress"
        lead="What each learner is working on, what their tutors have said and how often lessons are happening."
      />

      <LearnerSwitcher learners={learners} value={active} onChange={setLearnerId} />

      {!learner || progress.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="size-6" aria-hidden />}
          title="No progress recorded yet"
          body="After a few lessons, tutor feedback and a summary of what has been covered will appear here."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Subjects"
              value={String(progress.length)}
              hint={progress.map((entry) => subjectName(entry.subjectId)).join(', ')}
              tone="brand"
            />
            <StatCard
              label="Lessons completed"
              value={String(completed.length)}
              hint={`${progress.reduce((total, entry) => total + entry.lessonsPerMonth, 0)} a month on average`}
              tone="mint"
            />
            <StatCard
              label="Spend on tuition"
              value={formatPence(spend)}
              hint="Demo figures — no payments are taken"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {progress.map((entry) => (
              <Card key={entry.subjectId}>
                <CardHeader>
                  <div>
                    <CardTitle as="h2">{subjectName(entry.subjectId)}</CardTitle>
                    <p className="text-ink-subtle mt-0.5 text-sm">{entry.level}</p>
                  </div>
                  <Badge tone="mint">
                    {entry.lessonsPerMonth} {pluralise(entry.lessonsPerMonth, 'lesson')}
                    /month
                  </Badge>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <p className="text-ink-subtle text-sm">Towards the goal</p>
                      <p className="tabular text-sm font-medium">{entry.confidence}%</p>
                    </div>
                    <ProgressBar
                      value={entry.confidence}
                      label={`${learner.firstName}'s ${subjectName(entry.subjectId)} progress`}
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
                      What the tutor said
                    </p>
                    <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
                      {entry.lastFeedback}
                    </p>
                    <p className="text-ink-subtle mt-2 text-xs">
                      {entry.lastFeedbackBy} · {formatDayMonth(entry.lastFeedbackAt)}
                    </p>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
