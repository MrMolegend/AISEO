'use client';

import { useMemo, useState } from 'react';
import { Inbox, Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/overlay';
import { Select, Textarea } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { APPLICATION_STATUS } from '@/lib/application-status';
import { subjectName } from '@/lib/queries';
import { formatDayMonth, formatRelativeTime } from '@/lib/datetime';
import { formatPence, pluralise } from '@/lib/utils';
import type { ApplicationStatus, TutorApplication } from '@/lib/types';

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All applications' },
  { value: 'under-review', label: 'Under review' },
  { value: 'information-requested', label: 'Information requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Declined' },
];

/**
 * The application queue. Decisions write to the demo store, which updates the
 * status, appends a timeline entry and — for anyone watching the tutor's own
 * dashboard — changes what they see about their application.
 */
export default function AdminApplicationsPage() {
  const { applications, hydrated, decideApplication, addApplicationNote } = useDemo();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications.filter((application) => {
      if (status !== 'all' && application.status !== status) return false;
      if (!needle) return true;
      return [
        application.firstName,
        application.lastName,
        application.email,
        application.location,
        application.headline,
        ...application.subjects.map((id) => subjectName(id)),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [applications, query, status]);

  const open = applications.find((application) => application.id === openId);

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  function decide(application: TutorApplication, next: ApplicationStatus, label: string) {
    decideApplication(application.id, next, label);
    if (note.trim()) {
      addApplicationNote(application.id, note.trim());
      setNote('');
    }
    toast({
      title: `${application.firstName} ${application.lastName}: ${APPLICATION_STATUS[next].label.toLowerCase()}`,
      description:
        next === 'approved'
          ? 'The profile would now be published to the marketplace.'
          : 'The applicant would be notified by email.',
      tone: next === 'rejected' ? 'warning' : 'success',
    });
    setOpenId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutor applications"
        lead="Read the application, check the qualifications, then approve, ask for more or decline. Every decision is recorded on the applicant's timeline."
      />

      <div className="flex flex-wrap gap-2.5">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <label htmlFor="application-search" className="sr-only">
            Search applications
          </label>
          <input
            id="application-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, subject or location"
            className="border-line-strong bg-surface placeholder:text-ink-subtle/80 focus:border-brand h-11 w-full rounded-[var(--radius-control)] border pr-3.5 pl-10 text-sm"
          />
        </div>
        <label htmlFor="application-status" className="sr-only">
          Filter by status
        </label>
        <Select
          id="application-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-auto min-w-48"
        >
          {FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-ink-subtle text-sm" role="status" aria-live="polite">
        {filtered.length} {pluralise(filtered.length, 'application')}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" aria-hidden />}
          title="Nothing matches"
          body="Try a different search term, or set the status filter back to all applications."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((application) => (
            <li key={application.id}>
              <Card>
                <CardBody className="flex flex-wrap items-start gap-4">
                  <Avatar
                    firstName={application.firstName}
                    lastName={application.lastName}
                    tone={application.avatarTone}
                    size="lg"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h2 className="font-semibold">
                        {application.firstName} {application.lastName}
                      </h2>
                      <Badge tone={APPLICATION_STATUS[application.status].tone}>
                        {APPLICATION_STATUS[application.status].label}
                      </Badge>
                    </div>
                    <p className="text-ink-muted mt-1 text-sm">{application.headline}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {application.subjects.map((id) => (
                        <Badge key={id} tone="brand">
                          {subjectName(id)}
                        </Badge>
                      ))}
                      {application.levels.map((level) => (
                        <Badge key={level} tone="outline">
                          {level}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-ink-subtle mt-2.5 text-xs">
                      {application.location} · {application.yearsExperience}{' '}
                      {pluralise(application.yearsExperience, 'year')} experience ·{' '}
                      {formatPence(application.hourlyRate)}/hr · applied{' '}
                      {formatRelativeTime(application.submittedAt)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setOpenId(application.id);
                      setNote('');
                    }}
                  >
                    Review
                  </Button>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? `${open.firstName} ${open.lastName}` : 'Application'}
        description={open?.headline}
        className="sm:max-w-2xl"
        footer={
          open && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() =>
                  decide(open, 'information-requested', 'Information requested')
                }
              >
                Request information
              </Button>
              <Button
                variant="danger"
                onClick={() => decide(open, 'rejected', 'Application declined')}
              >
                Decline
              </Button>
              <Button onClick={() => decide(open, 'approved', 'Approved and published')}>
                Approve
              </Button>
            </div>
          )
        }
      >
        {open && (
          <div className="space-y-5 text-sm">
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-ink-subtle text-xs">Email</dt>
                <dd className="mt-0.5 break-all">{open.email}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle text-xs">Phone</dt>
                <dd className="mt-0.5">{open.phone}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle text-xs">Location</dt>
                <dd className="mt-0.5">{open.location}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle text-xs">Proposed rate</dt>
                <dd className="tabular mt-0.5">{formatPence(open.hourlyRate)} an hour</dd>
              </div>
            </dl>

            <Section title="Subjects and levels">
              <div className="flex flex-wrap gap-1.5">
                {open.subjects.map((id) => (
                  <Badge key={id} tone="brand">
                    {subjectName(id)}
                  </Badge>
                ))}
                {open.levels.map((level) => (
                  <Badge key={level} tone="outline">
                    {level}
                  </Badge>
                ))}
              </div>
            </Section>

            <Section title="Experience">
              <p className="text-ink-muted leading-relaxed">{open.experience}</p>
            </Section>

            <Section title="Qualifications">
              <p className="text-ink-muted leading-relaxed">{open.qualifications}</p>
            </Section>

            <Section title="Teaching approach">
              <p className="text-ink-muted leading-relaxed">{open.approach}</p>
            </Section>

            <Section title="Availability">
              <p className="text-ink-muted leading-relaxed">{open.availabilitySummary}</p>
            </Section>

            <Section title="Timeline">
              <ol className="space-y-2.5">
                {open.timeline.map((entry) => (
                  <li key={`${entry.at}-${entry.label}`} className="flex gap-3">
                    <span
                      className="bg-brand mt-1.5 size-2 shrink-0 rounded-full"
                      aria-hidden
                    />
                    <span>
                      <span className="block font-medium">{entry.label}</span>
                      <span className="text-ink-subtle block text-xs">
                        {entry.by} · {formatDayMonth(entry.at)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Section>

            {open.internalNotes.length > 0 && (
              <Section title="Internal notes">
                <ul className="space-y-2.5">
                  {open.internalNotes.map((entry) => (
                    <li
                      key={`${entry.at}-${entry.body}`}
                      className="border-line bg-surface-subtle rounded-[var(--radius-control)] border p-3"
                    >
                      <p className="text-ink-muted leading-relaxed">{entry.body}</p>
                      <p className="text-ink-subtle mt-1 text-xs">
                        {entry.author} · {formatDayMonth(entry.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Add an internal note">
              <label htmlFor="internal-note" className="sr-only">
                Internal note
              </label>
              <Textarea
                id="internal-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Visible to the platform team only. Saved with your decision."
                className="min-h-20"
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={!note.trim()}
                onClick={() => {
                  addApplicationNote(open.id, note.trim());
                  setNote('');
                  toast({ title: 'Note added' });
                }}
              >
                Save note
              </Button>
            </Section>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-ink-subtle mb-2 text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}
