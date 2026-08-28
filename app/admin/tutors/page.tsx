'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Modal } from '@/components/ui/overlay';
import { Field, Input, Select, Textarea, Toggle } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Rating } from '@/components/ui/rating';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { subjectName } from '@/lib/queries';
import { formatPence, pluralise } from '@/lib/utils';

export default function AdminTutorsPage() {
  const { tutors, hydrated, setTutorFlags, isSuspended, saveTutorProfile } = useDemo();
  const { toast } = useToast();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [rate, setRate] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tutors.filter((tutor) => {
      if (filter === 'verified' && !tutor.verified) return false;
      if (filter === 'unverified' && tutor.verified) return false;
      if (filter === 'featured' && !tutor.featured) return false;
      if (filter === 'suspended' && !isSuspended(tutor.id)) return false;
      if (!needle) return true;
      return `${tutor.firstName} ${tutor.lastName} ${tutor.subjects.map((id) => subjectName(id)).join(' ')}`
        .toLowerCase()
        .includes(needle);
    });
  }, [tutors, query, filter, isSuspended]);

  const editing = tutors.find((tutor) => tutor.id === editingId);

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tutors"
        lead="Verification, featuring and account status. Changes take effect on the public marketplace immediately."
      />

      <div className="flex flex-wrap gap-2.5">
        <div className="relative min-w-56 flex-1">
          <Search
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <label htmlFor="tutor-search" className="sr-only">
            Search tutors
          </label>
          <input
            id="tutor-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or subject"
            className="border-line-strong bg-surface placeholder:text-ink-subtle/80 focus:border-brand h-11 w-full rounded-[var(--radius-control)] border pr-3.5 pl-10 text-sm"
          />
        </div>
        <label htmlFor="tutor-filter" className="sr-only">
          Filter tutors
        </label>
        <Select
          id="tutor-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="w-auto min-w-44"
        >
          <option value="all">All tutors</option>
          <option value="verified">Verified</option>
          <option value="unverified">Not verified</option>
          <option value="featured">Featured</option>
          <option value="suspended">Suspended</option>
        </Select>
      </div>

      <p className="text-ink-subtle text-sm" role="status" aria-live="polite">
        {filtered.length} {pluralise(filtered.length, 'tutor')}
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          title="No tutors match"
          body="Adjust the search or set the filter back to all tutors."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((tutor) => {
            const suspended = isSuspended(tutor.id);
            return (
              <li key={tutor.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-start gap-4">
                    <Avatar
                      firstName={tutor.firstName}
                      lastName={tutor.lastName}
                      tone={tutor.avatarTone}
                      size="lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <h2 className="font-semibold">
                          {tutor.firstName} {tutor.lastName}
                        </h2>
                        {tutor.verified && <Badge tone="brand">Verified</Badge>}
                        {tutor.featured && <Badge tone="mint">Featured</Badge>}
                        {suspended && <Badge tone="danger">Suspended</Badge>}
                      </div>
                      <p className="text-ink-muted mt-1 text-sm">{tutor.headline}</p>
                      <p className="text-ink-subtle mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        <span>
                          {tutor.subjects.map((id) => subjectName(id)).join(', ')}
                        </span>
                        <span className="tabular">
                          {formatPence(tutor.hourlyRate)}/hr
                        </span>
                        <span>{tutor.lessonsCompleted} lessons</span>
                      </p>
                      <div className="mt-2">
                        <Rating
                          value={tutor.rating}
                          count={tutor.reviewCount}
                          size="sm"
                        />
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:w-64">
                      <Toggle
                        checked={tutor.verified}
                        onChange={(next) => {
                          setTutorFlags(tutor.id, { verified: next });
                          toast({
                            title: next ? 'Tutor verified' : 'Verification removed',
                            description: `${tutor.firstName} ${tutor.lastName}`,
                            tone: next ? 'success' : 'warning',
                          });
                        }}
                        label="Verified"
                      />
                      <Toggle
                        checked={tutor.featured}
                        onChange={(next) => {
                          setTutorFlags(tutor.id, { featured: next });
                          toast({
                            title: next ? 'Added to featured' : 'Removed from featured',
                            description: 'The homepage selection updates immediately.',
                          });
                        }}
                        label="Featured on homepage"
                      />
                      <Toggle
                        checked={!suspended}
                        onChange={(next) => {
                          setTutorFlags(tutor.id, { suspended: !next });
                          toast({
                            title: next ? 'Tutor reinstated' : 'Tutor suspended',
                            description: next
                              ? 'The profile is back in search results.'
                              : 'The profile is hidden from search results.',
                            tone: next ? 'success' : 'warning',
                          });
                        }}
                        label="Active"
                      />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditingId(tutor.id);
                            setHeadline(tutor.headline);
                            setAbout(tutor.about);
                            setRate(Math.round(tutor.hourlyRate / 100));
                          }}
                        >
                          Edit
                        </Button>
                        <ButtonLink
                          href={`/tutors/${tutor.slug}`}
                          size="sm"
                          variant="ghost"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          Public
                        </ButtonLink>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditingId(null)}
        title={editing ? `Edit ${editing.firstName} ${editing.lastName}` : 'Edit tutor'}
        description="Administrative edits are recorded against the profile."
        footer={
          editing && (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingId(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  saveTutorProfile(editing.id, {
                    headline,
                    about,
                    hourlyRate: rate * 100,
                  });
                  toast({
                    title: 'Profile updated',
                    description: `${editing.firstName} ${editing.lastName}'s public profile has changed.`,
                  });
                  setEditingId(null);
                }}
              >
                Save changes
              </Button>
            </div>
          )
        }
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Headline">
              {({ id }) => (
                <Input
                  id={id}
                  value={headline}
                  onChange={(event) => setHeadline(event.target.value)}
                />
              )}
            </Field>
            <Field label="About">
              {({ id }) => (
                <Textarea
                  id={id}
                  value={about}
                  onChange={(event) => setAbout(event.target.value)}
                />
              )}
            </Field>
            <Field label="Hourly rate (£)">
              {({ id }) => (
                <Input
                  id={id}
                  type="number"
                  min={10}
                  max={200}
                  value={rate}
                  onChange={(event) => setRate(Number(event.target.value))}
                  className="max-w-32"
                />
              )}
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
