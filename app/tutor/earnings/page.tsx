'use client';

import { Banknote, Info, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { earningsSummary, weeklyEarnings } from '@/lib/tutor-metrics';
import { bookingLearnerName, subjectName } from '@/lib/queries';
import { formatDayMonth } from '@/lib/datetime';
import { formatPence } from '@/lib/utils';

export default function TutorEarningsPage() {
  const { account, bookings, hydrated } = useDemo();
  const { toast } = useToast();

  if (!hydrated || !account?.tutorId) return <Skeleton className="h-96 w-full" />;

  const mine = bookings.filter((booking) => booking.tutorId === account.tutorId);
  const summary = earningsSummary(mine);
  const weekly = weeklyEarnings(mine);
  const peak = Math.max(...weekly.map((week) => week.pence), 1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        lead="What you have earned, what is still to come, and where payouts will appear once payments are connected."
      />

      <div className="border-warning-line bg-warning-bg flex gap-3 rounded-[var(--radius-card)] border p-4">
        <Info className="text-warning mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-ink-muted text-sm leading-relaxed">
          <span className="text-ink font-semibold">Demonstration figures.</span> No money
          has moved. These totals are calculated from the demo bookings so the layout can
          be judged with realistic numbers.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Available balance"
          value={formatPence(summary.availablePence)}
          hint="From completed lessons"
          icon={<Wallet className="size-4" aria-hidden />}
          tone="mint"
        />
        <StatCard
          label="Pending"
          value={formatPence(summary.pendingPence)}
          hint="Held until the lesson is taught"
          icon={<Banknote className="size-4" aria-hidden />}
          tone="brand"
        />
        <StatCard
          label="This week"
          value={formatPence(summary.thisWeekPence)}
          hint={`${summary.lessonsThisWeek} lessons completed`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Last eight weeks</CardTitle>
        </CardHeader>
        <CardBody>
          <ul className="flex h-44 items-end gap-2 sm:gap-3">
            {weekly.map((week) => (
              <li key={week.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-ink-subtle tabular text-[0.6875rem]">
                  {week.pence > 0 ? formatPence(week.pence) : ''}
                </span>
                <span
                  className="bg-brand-subtle border-brand-line w-full rounded-t-[6px] border-x border-t"
                  style={{
                    height: `${Math.max(4, Math.round((week.pence / peak) * 110))}px`,
                  }}
                  aria-hidden
                />
                <span className="text-ink-subtle text-[0.6875rem] whitespace-nowrap">
                  {week.label}
                </span>
                <span className="sr-only">
                  {week.label}: {formatPence(week.pence)}
                </span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Lesson earnings</CardTitle>
        </CardHeader>
        <CardBody>
          {summary.completed.length === 0 ? (
            <EmptyState
              icon={<Wallet className="size-6" aria-hidden />}
              title="No completed lessons yet"
              body="Earnings appear here as soon as a lesson is marked complete."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <caption className="sr-only">
                  Completed lessons and the amount earned from each
                </caption>
                <thead>
                  <tr className="border-line text-ink-subtle border-b text-left">
                    <th scope="col" className="pb-2 font-medium">
                      Lesson
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Student
                    </th>
                    <th scope="col" className="pb-2 font-medium">
                      Date
                    </th>
                    <th scope="col" className="pb-2 text-right font-medium">
                      Earned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {summary.completed
                    .slice()
                    .reverse()
                    .map((booking) => (
                      <tr key={booking.id}>
                        <td className="py-3">
                          <span className="font-medium">
                            {subjectName(booking.subjectId)}
                          </span>
                          <span className="text-ink-subtle block text-xs">
                            {booking.level} · {booking.durationMins} min
                          </span>
                        </td>
                        <td className="text-ink-muted py-3">
                          {bookingLearnerName(booking)}
                        </td>
                        <td className="text-ink-muted py-3">
                          {formatDayMonth(booking.startsAt)}
                        </td>
                        <td className="tabular py-3 text-right font-medium">
                          {formatPence(booking.lessonPence)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Payouts</CardTitle>
          <Badge tone="warning">Not connected</Badge>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-ink-muted text-sm leading-relaxed">
            Payouts will be handled by a payment provider, with tutors onboarded to their
            connected-account flow. Bank details would be collected there rather than by
            Tutor Hub, and paid out weekly after a lesson is completed.
          </p>
          <Button
            variant="secondary"
            onClick={() =>
              toast({
                title: 'Payouts are not connected yet',
                description:
                  'Stripe Connect onboarding will open from here in the live product.',
                tone: 'info',
              })
            }
          >
            Set up payouts
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
