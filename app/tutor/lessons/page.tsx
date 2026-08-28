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
  { id: 'requests', label: 'Requests' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function TutorLessonsPage() {
  const { account, bookings, hydrated } = useDemo();
  const [tab, setTab] = useState('requests');

  if (!hydrated || !account?.tutorId) return <Skeleton className="h-96 w-full" />;

  const mine = bookings.filter((booking) => booking.tutorId === account.tutorId);
  const groups: Record<string, Booking[]> = {
    requests: mine.filter(
      (booking) =>
        booking.status === 'requested' || booking.status === 'reschedule-requested',
    ),
    upcoming: mine.filter((booking) => booking.status === 'confirmed'),
    completed: mine.filter((booking) => booking.status === 'completed').reverse(),
    cancelled: mine.filter((booking) => booking.status === 'cancelled'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lessons"
        lead="Accept requests, join a lesson, or look back at what you taught."
        action={
          <ButtonLink href="/tutor/availability" variant="secondary">
            Manage availability
          </ButtonLink>
        }
      />

      <Tabs
        items={TABS.map((item) => ({
          ...item,
          label:
            (groups[item.id]?.length ?? 0) > 0
              ? `${item.label} (${groups[item.id]?.length})`
              : item.label,
        }))}
        value={tab}
        onChange={setTab}
      />

      <div>
        {TABS.map((item) => (
          <TabPanel key={item.id} id={item.id} active={tab === item.id}>
            {(groups[item.id]?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-6" aria-hidden />}
                title={`Nothing in ${item.label.toLowerCase()}`}
                body={
                  item.id === 'requests'
                    ? 'New booking requests land here. Replying quickly keeps your listed response time accurate.'
                    : 'Lessons move into this list as their status changes.'
                }
              />
            ) : (
              <ul className="space-y-3">
                {groups[item.id]?.map((booking) => (
                  <li key={booking.id}>
                    <LessonCard booking={booking} perspective="tutor" />
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
