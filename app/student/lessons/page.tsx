'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { LessonCard } from '@/components/dashboard/lesson-card';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { useDemo } from '@/lib/store/demo-store';
import type { Booking } from '@/lib/types';

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function StudentLessonsPage() {
  const { account, bookings, hydrated } = useDemo();
  const [tab, setTab] = useState('upcoming');

  if (!hydrated || !account) return <Skeleton className="h-96 w-full" />;

  const mine = bookings.filter((booking) => booking.bookedById === account.id);
  const groups: Record<string, Booking[]> = {
    upcoming: mine.filter(
      (booking) =>
        booking.status === 'confirmed' ||
        booking.status === 'requested' ||
        booking.status === 'reschedule-requested',
    ),
    completed: mine.filter((booking) => booking.status === 'completed').reverse(),
    cancelled: mine.filter((booking) => booking.status === 'cancelled'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your lessons"
        lead="Join a lesson, ask to move one, or look back at what a tutor said afterwards."
        action={<ButtonLink href="/tutors">Book another lesson</ButtonLink>}
      />

      <Tabs items={TABS} value={tab} onChange={setTab} />

      <div>
        {TABS.map((item) => (
          <TabPanel key={item.id} id={item.id} active={tab === item.id}>
            {(groups[item.id]?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" aria-hidden />}
                title={`No ${item.label.toLowerCase()} lessons`}
                body={
                  item.id === 'upcoming'
                    ? 'Book a lesson and it will appear here with a join button close to the start time.'
                    : `Nothing in this list yet.`
                }
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
