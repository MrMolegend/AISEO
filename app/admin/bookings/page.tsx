'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/overlay';
import { Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { BOOKING_STATUS } from '@/lib/booking-status';
import { bookingLearnerName, subjectName, tutorName } from '@/lib/queries';
import { formatDateTime, formatDayMonth, formatDurationLabel } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';
import type { BookingStatus } from '@/lib/types';

const STATUSES: BookingStatus[] = [
  'requested',
  'confirmed',
  'completed',
  'cancelled',
  'reschedule-requested',
];

export default function AdminBookingsPage() {
  const { bookings, hydrated, setBookingStatus } = useDemo();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return bookings
      .slice()
      .reverse()
      .filter((booking) => {
        if (status !== 'all' && booking.status !== status) return false;
        if (!needle) return true;
        return `${booking.reference} ${bookingLearnerName(booking)} ${tutorName(booking.tutorId)} ${subjectName(booking.subjectId)}`
          .toLowerCase()
          .includes(needle);
      });
  }, [bookings, query, status]);

  const open = bookings.find((booking) => booking.id === openId);

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bookings"
        lead="Every lesson on the platform, with the ability to correct a status when support needs to intervene."
      />

      <div className="flex flex-wrap gap-2.5">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <label htmlFor="booking-search" className="sr-only">
            Search bookings
          </label>
          <input
            id="booking-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by reference, student, tutor or subject"
            className="border-line-strong bg-surface placeholder:text-ink-subtle/80 focus:border-brand h-11 w-full rounded-[var(--radius-control)] border pr-3.5 pl-10 text-sm"
          />
        </div>
        <label htmlFor="booking-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="booking-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-auto min-w-48"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {BOOKING_STATUS[item].label}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-ink-subtle text-sm" role="status" aria-live="polite">
        {filtered.length} {pluralise(filtered.length, 'booking')}
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="No bookings match" body="Try a different search or status." />
      ) : (
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[46rem] text-sm">
              <caption className="sr-only">All bookings on the platform</caption>
              <thead>
                <tr className="border-line text-ink-subtle border-b text-left">
                  <th scope="col" className="px-4 py-3 font-medium">
                    Reference
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Student
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Tutor
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Amount
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y">
                {filtered.map((booking) => (
                  <tr key={booking.id}>
                    <td className="tabular px-4 py-3 font-medium">{booking.reference}</td>
                    <td className="text-ink-muted px-4 py-3">
                      {bookingLearnerName(booking)}
                    </td>
                    <td className="text-ink-muted px-4 py-3">
                      {tutorName(booking.tutorId)}
                    </td>
                    <td className="text-ink-muted px-4 py-3">
                      {formatDayMonth(booking.startsAt)}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {formatPence(booking.lessonPence + booking.feePence)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={BOOKING_STATUS[booking.status].tone}>
                        {BOOKING_STATUS[booking.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOpenId(booking.id)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      <Modal
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? `Booking ${open.reference}` : 'Booking'}
      >
        {open && (
          <div className="space-y-5 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Detail label="Student" value={bookingLearnerName(open)} />
              <Detail label="Tutor" value={tutorName(open.tutorId)} />
              <Detail
                label="Subject"
                value={`${subjectName(open.subjectId)} · ${open.level}`}
              />
              <Detail label="When" value={formatDateTime(open.startsAt)} />
              <Detail label="Length" value={formatDurationLabel(open.durationMins)} />
              <Detail label="Lesson" value={formatPence(open.lessonPence)} />
              <Detail label="Service fee" value={formatPence(open.feePence)} />
              <Detail
                label="Total"
                value={formatPence(open.lessonPence + open.feePence)}
              />
            </dl>

            {open.note && (
              <div>
                <p className="text-ink-subtle text-xs">Note from the student</p>
                <p className="text-ink-muted mt-1 leading-relaxed">{open.note}</p>
              </div>
            )}

            <div className="border-line border-t pt-4">
              <label
                htmlFor="booking-status-update"
                className="text-ink mb-2 block text-sm font-medium"
              >
                Update status
              </label>
              <Select
                id="booking-status-update"
                value={open.status}
                onChange={(event) => {
                  const next = event.target.value as BookingStatus;
                  setBookingStatus(open.id, next);
                  toast({
                    title: `Booking ${open.reference} updated`,
                    description: `Status set to ${BOOKING_STATUS[next].label.toLowerCase()}.`,
                  });
                }}
              >
                {STATUSES.map((item) => (
                  <option key={item} value={item}>
                    {BOOKING_STATUS[item].label}
                  </option>
                ))}
              </Select>
              <p className="text-ink-subtle mt-2 text-xs leading-relaxed">
                Changing a status here is a support action. In the live product it would
                be recorded against the booking with the administrator’s name.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-subtle text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
