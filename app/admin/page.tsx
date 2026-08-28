'use client';

import Link from 'next/link';
import {
  CalendarDays,
  Flag,
  GraduationCap,
  Inbox,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { StatCard } from '@/components/dashboard/stat-card';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { APPLICATION_STATUS, REPORT_STATUS } from '@/lib/application-status';
import { bookingLearnerName, getAccounts, subjectName, tutorName } from '@/lib/queries';
import { formatRelativeDay, formatRelativeTime } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';

export default function AdminOverviewPage() {
  const { applications, reports, bookings, tutors, hydrated, isSuspended } = useDemo();

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  const pending = applications.filter(
    (application) =>
      application.status === 'under-review' ||
      application.status === 'information-requested',
  );
  const openReports = reports.filter((report) => report.status !== 'resolved');
  const upcoming = bookings.filter((booking) => booking.status === 'confirmed');
  const activeTutors = tutors.filter((tutor) => !isSuspended(tutor.id));
  const verified = activeTutors.filter((tutor) => tutor.verified);
  const grossPence = bookings
    .filter((booking) => booking.status !== 'cancelled')
    .reduce((total, booking) => total + booking.lessonPence + booking.feePence, 0);

  const activity = [
    ...applications.slice(0, 3).map((application) => ({
      id: `app-${application.id}`,
      at: application.submittedAt,
      text: `${application.firstName} ${application.lastName} applied to teach ${application.subjects.map((id) => subjectName(id)).join(' and ')}`,
      href: '/admin/applications',
    })),
    ...reports.slice(0, 2).map((report) => ({
      id: `rep-${report.id}`,
      at: report.createdAt,
      text: `${report.reporterName} reported ${report.subjectOfReport} — ${report.category.toLowerCase()}`,
      href: '/admin/reports',
    })),
    ...bookings.slice(-2).map((booking) => ({
      id: `bk-${booking.id}`,
      at: booking.createdAt,
      text: `${bookingLearnerName(booking)} booked ${subjectName(booking.subjectId)} with ${tutorName(booking.tutorId)}`,
      href: '/admin/bookings',
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform overview"
        lead="Applications waiting on a decision, what is happening on the marketplace, and anything that needs attention."
        action={
          <ButtonLink href="/admin/applications">
            Review applications
            {pending.length > 0 && (
              <span className="ml-1 rounded bg-white/20 px-1.5 text-sm">
                {pending.length}
              </span>
            )}
          </ButtonLink>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Applications waiting"
          value={String(pending.length)}
          hint={pending.length ? 'Oldest first in the queue' : 'Queue is clear'}
          icon={<Inbox className="size-4" aria-hidden />}
          tone={pending.length ? 'warning' : 'default'}
        />
        <StatCard
          label="Active tutors"
          value={String(activeTutors.length)}
          hint={`${verified.length} verified`}
          icon={<GraduationCap className="size-4" aria-hidden />}
          tone="brand"
        />
        <StatCard
          label="Upcoming lessons"
          value={String(upcoming.length)}
          hint={`${formatPence(grossPence)} booked in total`}
          icon={<CalendarDays className="size-4" aria-hidden />}
          tone="mint"
        />
        <StatCard
          label="Open reports"
          value={String(openReports.length)}
          hint={openReports.length ? 'Includes escalated cases' : 'Nothing outstanding'}
          icon={<Flag className="size-4" aria-hidden />}
          tone={openReports.length ? 'warning' : 'default'}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Applications waiting</CardTitle>
              <ButtonLink href="/admin/applications" variant="ghost" size="sm">
                Open queue
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {pending.length === 0 ? (
                <p className="text-ink-subtle py-4 text-center text-sm">
                  Nothing waiting. New applications appear here as soon as they are
                  submitted.
                </p>
              ) : (
                <ul className="divide-line divide-y">
                  {pending.map((application) => (
                    <li key={application.id}>
                      <Link
                        href="/admin/applications"
                        className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <Avatar
                          firstName={application.firstName}
                          lastName={application.lastName}
                          tone={application.avatarTone}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {application.firstName} {application.lastName}
                          </span>
                          <span className="text-ink-subtle block text-xs">
                            {application.subjects.map((id) => subjectName(id)).join(', ')}{' '}
                            · {application.location}
                          </span>
                        </span>
                        <Badge tone={APPLICATION_STATUS[application.status].tone}>
                          {APPLICATION_STATUS[application.status].label}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardBody>
              <ul className="divide-line divide-y">
                {activity.slice(0, 7).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <span className="text-ink-muted text-sm leading-relaxed">
                        {item.text}
                      </span>
                      <span className="text-ink-subtle shrink-0 text-xs whitespace-nowrap">
                        {formatRelativeTime(item.at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Marketplace health</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <HealthRow
                label="Tutors verified"
                value={Math.round(
                  (verified.length / Math.max(activeTutors.length, 1)) * 100,
                )}
                detail={`${verified.length} of ${activeTutors.length}`}
              />
              <HealthRow
                label="Applications decided"
                value={Math.round(
                  ((applications.length - pending.length) /
                    Math.max(applications.length, 1)) *
                    100,
                )}
                detail={`${applications.length - pending.length} of ${applications.length}`}
              />
              <HealthRow
                label="Reports resolved"
                value={Math.round(
                  ((reports.length - openReports.length) / Math.max(reports.length, 1)) *
                    100,
                )}
                detail={`${reports.length - openReports.length} of ${reports.length}`}
              />
              <p className="text-ink-subtle border-line border-t pt-3 text-xs leading-relaxed">
                Calculated from the demonstration data in this browser.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open reports</CardTitle>
              <ButtonLink href="/admin/reports" variant="ghost" size="sm">
                Triage
              </ButtonLink>
            </CardHeader>
            <CardBody>
              {openReports.length === 0 ? (
                <p className="text-ink-subtle text-sm">Nothing outstanding.</p>
              ) : (
                <ul className="divide-line divide-y">
                  {openReports.slice(0, 4).map((report) => (
                    <li key={report.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{report.category}</p>
                          <p className="text-ink-subtle text-xs">
                            {report.subjectOfReport} ·{' '}
                            {formatRelativeDay(report.createdAt)}
                          </p>
                        </div>
                        <Badge tone={REPORT_STATUS[report.status].tone}>
                          {REPORT_STATUS[report.status].label}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
              <ButtonLink href="/admin/users" variant="ghost" size="sm">
                Manage
              </ButtonLink>
            </CardHeader>
            <CardBody>
              <ul className="text-ink-muted space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="text-ink-subtle size-4" aria-hidden />
                    Accounts
                  </span>
                  <span className="tabular font-medium">{getAccounts().length}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="text-ink-subtle size-4" aria-hidden />
                    Tutor profiles
                  </span>
                  <span className="tabular font-medium">{tutors.length}</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="text-ink-subtle size-4" aria-hidden />
                    Bookings
                  </span>
                  <span className="tabular font-medium">
                    {bookings.length} {pluralise(bookings.length, 'record')}
                  </span>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function HealthRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-sm">{label}</p>
        <p className="text-ink-subtle tabular text-xs">
          {detail} · {value}%
        </p>
      </div>
      <ProgressBar value={value} label={`${label}: ${value}%`} tone="mint" />
    </div>
  );
}
