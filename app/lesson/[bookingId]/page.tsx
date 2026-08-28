'use client';

import { use } from 'react';
import { CalendarX2 } from 'lucide-react';
import { LessonRoom } from '@/components/lesson/lesson-room';
import { EmptyState } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';

/**
 * The room is always tied to a real local booking — there is no way to open a
 * lesson that does not exist.
 */
export default function LessonPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const { getBooking, hydrated } = useDemo();

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#0d1322]">
        <p className="text-sm text-white/60">Opening the lesson room…</p>
      </div>
    );
  }

  const booking = getBooking(bookingId);

  if (!booking) {
    return (
      <div className="container-narrow flex min-h-dvh items-center justify-center py-16">
        <EmptyState
          icon={<CalendarX2 className="size-6" aria-hidden />}
          title="That lesson is not in your list"
          body="The lesson room only opens for a booking on this device. Choose a lesson from your dashboard to join it."
          action={{ label: 'Go to your lessons', href: '/student/lessons' }}
        />
      </div>
    );
  }

  return <LessonRoom booking={booking} />;
}
