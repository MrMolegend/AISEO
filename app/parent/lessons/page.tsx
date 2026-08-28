'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { LessonCard } from '@/components/dashboard/lesson-card';
import { LearnerSwitcher } from '@/components/parent/learner-switcher';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { useDemo } from '@/lib/store/demo-store';
import { getLearners } from '@/lib/queries';
import type { Booking } from '@/lib/types';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function ParentLessonsPage() {
  const { account, bookings, hydrated } = useDemo();
  const [tab, setTab] = useState('upcoming');
  const [learnerId, setLearnerId] = useState('');

  if (!hydrated || !account) return <Skeleton className="h-96 w-full" />;

  const learners = getLearners(account.id);
  const mine = bookings.filter((booking) => booking.bookedById === account.id);
  const scoped = learnerId
    ? mine.filter((booking) => booking.learnerId === learnerId)
    : mine;

  const groups: Record<string, Booking[]> = {
    upcoming: scoped.filter(
      (booking) =>
        booking.status === 'confirmed' ||
        booking.status === 'requested' ||
        booking.status === 'reschedule-requested',
    ),
    completed: scoped.filter((booking) => booking.status === 'completed').reverse(),
    cancelled: scoped.filter((booking) => booking.status === 'cancelled'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lessons"
        lead="Everything booked for your learners, with the option to move or cancel a lesson."
        action={<ButtonLink href="/tutors">Book a lesson</ButtonLink>}
      />

      <LearnerSwitcher
        learners={learners}
        value={learnerId}
        onChange={setLearnerId}
        allowAll
      />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      <div>
        {TABS.map((item) => (
          <TabPanel key={item.id} id={item.id} active={tab === item.id}>
            {(groups[item.id]?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" aria-hidden />}
                title={`No ${item.label.toLowerCase()} lessons`}
                body="Lessons appear here as soon as they are booked, and move between these tabs as their status changes."
                {...(item.id === 'upcoming'
                  ? { action: { label: 'Find a tutor', href: '/tutors' } }
                  : {})}
              />
            ) : (
              <ul className="space-y-3">
                {groups[item.id]?.map((booking) => (
                  <li key={booking.id}>
                    <LessonCard booking={booking} perspective="learner" />
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        ))}
      </div>
    </div>
  );
}
