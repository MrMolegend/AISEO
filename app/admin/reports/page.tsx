'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { REPORT_STATUS } from '@/lib/application-status';
import { ROLE_LABELS } from '@/lib/nav';
import { formatDayMonth, formatRelativeTime } from '@/lib/datetime';
import { pluralise } from '@/lib/utils';
import type { ReportStatus } from '@/lib/types';

const STATUSES: ReportStatus[] = ['open', 'investigating', 'resolved', 'escalated'];

export default function AdminReportsPage() {
  const { reports, hydrated, setReportStatus } = useDemo();
  const { toast } = useToast();
  const [filter, setFilter] = useState('open-only');

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  const filtered = reports.filter((report) => {
    if (filter === 'all') return true;
    if (filter === 'open-only') return report.status !== 'resolved';
    return report.status === filter;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        lead="Concerns raised by students, parents and tutors. Anything involving a safeguarding risk should be escalated rather than resolved here."
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="report-filter" className="sr-only">
          Filter reports
        </label>
        <Select
          id="report-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-auto min-w-48"
        >
          <option value="open-only">Needs attention</option>
          <option value="all">All reports</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {REPORT_STATUS[status].label}
            </option>
          ))}
        </Select>
        <p className="text-ink-subtle text-sm" role="status" aria-live="polite">
          {filtered.length} {pluralise(filtered.length, 'report')}
        </p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Flag className="size-6" aria-hidden />}
          title="Nothing to triage"
          body="Reports raised from a lesson, a message or a profile appear here for the platform team."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((report) => (
            <li key={report.id}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <h2 className="font-semibold">{report.category}</h2>
                        <Badge tone={REPORT_STATUS[report.status].tone}>
                          {REPORT_STATUS[report.status].label}
                        </Badge>
                      </div>
                      <p className="text-ink-subtle mt-1 text-sm">
                        {report.reporterName} ({ROLE_LABELS[report.reporterRole]})
                        reported{' '}
                        <span className="text-ink font-medium">
                          {report.subjectOfReport}
                        </span>{' '}
                        · {report.subjectType}
                      </p>
                    </div>
                    <p className="text-ink-subtle shrink-0 text-xs">
                      {formatDayMonth(report.createdAt)} ·{' '}
                      {formatRelativeTime(report.createdAt)}
                    </p>
                  </div>

                  <p className="text-ink-muted border-line bg-surface-subtle rounded-[var(--radius-control)] border p-3.5 text-sm leading-relaxed">
                    {report.details}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {report.status !== 'investigating' &&
                      report.status !== 'resolved' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setReportStatus(report.id, 'investigating');
                            toast({
                              title: 'Marked as investigating',
                              description: report.category,
                            });
                          }}
                        >
                          Start investigating
                        </Button>
                      )}
                    {report.status !== 'resolved' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setReportStatus(report.id, 'resolved');
                          toast({
                            title: 'Report resolved',
                            description: `${report.category} — the reporter would be notified.`,
                          });
                        }}
                      >
                        Resolve
                      </Button>
                    )}
                    {report.status !== 'escalated' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setReportStatus(report.id, 'escalated');
                          toast({
                            title: 'Escalated to safeguarding',
                            description: 'The safeguarding contact would be alerted.',
                            tone: 'warning',
                          });
                        }}
                      >
                        Escalate
                      </Button>
                    )}
                    {report.status === 'resolved' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReportStatus(report.id, 'open');
                          toast({ title: 'Report reopened', tone: 'info' });
                        }}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
