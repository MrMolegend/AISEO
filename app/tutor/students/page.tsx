'use client';

import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { bookingLearnerName, subjectName } from '@/lib/queries';
import { formatRelativeDay } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';
import type { Booking } from '@/lib/types';

/**
 * Students are derived from bookings rather than stored separately — a tutor's
 * student list is exactly the set of people they have taught or are about to.
 */
export default function TutorStudentsPage() {
  const { account, bookings, hydrated, startConversation } = useDemo();
  const router = useRouter();

  if (!hydrated || !account?.tutorId) return <Skeleton className="h-96 w-full" />;

  const mine = bookings.filter((booking) => booking.tutorId === account.tutorId);
  const grouped = new Map<string, Booking[]>();
  for (const booking of mine) {
    const name = bookingLearnerName(booking);
    grouped.set(name, [...(grouped.get(name) ?? []), booking]);
  }

  const students = [...grouped.entries()].map(([name, list]) => {
    const completed = list.filter((booking) => booking.status === 'completed');
    const next = list.find((booking) => booking.status === 'confirmed');
    return {
      name,
      list,
      completed: completed.length,
      next,
      subjects: [...new Set(list.map((booking) => subjectName(booking.subjectId)))],
      earned: completed.reduce((total, booking) => total + booking.lessonPence, 0),
      level: list[0]?.level ?? '',
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        lead="Everyone you have taught or are about to, with what you have covered and what is next."
      />

      {students.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" aria-hidden />}
          title="No students yet"
          body="Once a booking is confirmed the student appears here with their lesson history."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {students.map((student) => (
            <Card key={student.name}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar
                    firstName={student.name.split(' ')[0] ?? ''}
                    lastName={student.name.split(' ')[1] ?? ''}
                    tone={student.name.length % 5}
                    size="md"
                  />
                  <div>
                    <CardTitle as="h2" className="text-[0.9375rem]">
                      {student.name}
                    </CardTitle>
                    <p className="text-ink-subtle mt-0.5 text-sm">{student.level}</p>
                  </div>
                </div>
                <Badge tone="neutral">
                  {student.completed} {pluralise(student.completed, 'lesson')}
                </Badge>
              </CardHeader>
              <CardBody className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {student.subjects.map((subject) => (
                    <Badge key={subject} tone="brand">
                      {subject}
                    </Badge>
                  ))}
                </div>

                <dl className="text-ink-muted grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-subtle text-xs">Next lesson</dt>
                    <dd className="mt-0.5 font-medium">
                      {student.next
                        ? formatRelativeDay(student.next.startsAt)
                        : 'Nothing booked'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-subtle text-xs">Earned</dt>
                    <dd className="tabular mt-0.5 font-medium">
                      {formatPence(student.earned)}
                    </dd>
                  </div>
                </dl>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const tutorId = account.tutorId;
                    if (!tutorId) return;
                    router.push(`/tutor/messages/${startConversation(tutorId)}`);
                  }}
                >
                  Open conversation
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
