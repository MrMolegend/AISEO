'use client';

import { GraduationCap, Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { getLearners, getProgressFor, getTutor, subjectName } from '@/lib/queries';
import { formatRelativeDay } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';

export default function ParentLearnersPage() {
  const { account, bookings, hydrated } = useDemo();
  const { toast } = useToast();

  if (!hydrated || !account) return <Skeleton className="h-96 w-full" />;

  const learners = getLearners(account.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learners"
        lead="The children linked to your account, the subjects they are working on and who is teaching them."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Adding a learner is not connected yet',
                description:
                  'This will create a linked profile once accounts are backed by Supabase.',
                tone: 'info',
              })
            }
          >
            <Plus className="size-4" aria-hidden />
            Add a learner
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {learners.map((learner) => {
          const theirs = bookings.filter((booking) => booking.learnerId === learner.id);
          const upcoming = theirs.filter((booking) => booking.status === 'confirmed');
          const completed = theirs.filter((booking) => booking.status === 'completed');
          const progress = getProgressFor(learner.id);
          const tutors = [...new Set(theirs.map((booking) => booking.tutorId))]
            .map((id) => getTutor(id))
            .filter((tutor): tutor is NonNullable<typeof tutor> => Boolean(tutor));
          const spend = theirs
            .filter((booking) => booking.status !== 'cancelled')
            .reduce(
              (total, booking) => total + booking.lessonPence + booking.feePence,
              0,
            );

          return (
            <Card key={learner.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar
                    firstName={learner.firstName}
                    lastName={learner.lastName}
                    tone={learner.avatarTone}
                    size="lg"
                  />
                  <div>
                    <CardTitle as="h2">
                      {learner.firstName} {learner.lastName}
                    </CardTitle>
                    <p className="text-ink-subtle mt-0.5 text-sm">
                      {learner.yearGroup} · {learner.level}
                    </p>
                  </div>
                </div>
                <Badge tone="mint">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Linked
                </Badge>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="border-line bg-surface-subtle rounded-[var(--radius-control)] border p-3.5">
                  <p className="text-ink-subtle text-xs font-medium">Goal</p>
                  <p className="text-ink mt-1 text-sm">{learner.goal}</p>
                </div>

                <div>
                  <p className="text-ink-subtle mb-2 text-xs font-medium">Subjects</p>
                  <div className="flex flex-wrap gap-1.5">
                    {learner.subjects.map((id) => (
                      <Badge key={id} tone="brand">
                        {subjectName(id)}
                      </Badge>
                    ))}
                  </div>
                </div>

                {progress.length > 0 && (
                  <div className="space-y-3">
                    {progress.map((entry) => (
                      <div key={entry.subjectId}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <p className="text-sm">{subjectName(entry.subjectId)}</p>
                          <p className="text-ink-subtle tabular text-xs">
                            {entry.confidence}%
                          </p>
                        </div>
                        <ProgressBar
                          value={entry.confidence}
                          label={`${learner.firstName}'s ${subjectName(entry.subjectId)} progress`}
                          tone="mint"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <dl className="text-ink-muted grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-subtle text-xs">Completed</dt>
                    <dd className="tabular mt-0.5 font-medium">{completed.length}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle text-xs">Next lesson</dt>
                    <dd className="mt-0.5 font-medium">
                      {upcoming[0] ? formatRelativeDay(upcoming[0].startsAt) : 'None'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle text-xs">Spend</dt>
                    <dd className="tabular mt-0.5 font-medium">{formatPence(spend)}</dd>
                  </div>
                </dl>

                {tutors.length > 0 && (
                  <div className="border-line border-t pt-4">
                    <p className="text-ink-subtle mb-2 flex items-center gap-1.5 text-xs font-medium">
                      <GraduationCap className="size-3.5" aria-hidden />
                      {tutors.length} {pluralise(tutors.length, 'tutor')}
                    </p>
                    <ul className="space-y-2">
                      {tutors.map((tutor) => (
                        <li key={tutor.id} className="flex items-center gap-2.5">
                          <Avatar
                            firstName={tutor.firstName}
                            lastName={tutor.lastName}
                            tone={tutor.avatarTone}
                            size="xs"
                          />
                          <span className="text-sm">
                            {tutor.firstName} {tutor.lastName}
                          </span>
                          <ButtonLink
                            href={`/tutors/${tutor.slug}`}
                            variant="ghost"
                            size="sm"
                            className="ml-auto"
                          >
                            Profile
                          </ButtonLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
