'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { subjectName } from '@/lib/queries';
import { cn, pluralise } from '@/lib/utils';

export default function AdminSettingsPage() {
  const { adminSettings, updateAdminSettings, setTutorFlags, tutors, hydrated } =
    useDemo();
  const { toast } = useToast();
  const [draft, setDraft] = useState(adminSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  function save(event: React.FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!draft.siteName.trim()) found.siteName = 'The site needs a name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.supportEmail))
      found.supportEmail = 'Enter a valid email address.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.safeguardingContact))
      found.safeguardingContact = 'Enter a valid email address.';
    if (draft.bookingWindowDays < 1 || draft.bookingWindowDays > 120)
      found.bookingWindowDays = 'Choose between 1 and 120 days.';
    if (draft.minNoticeHours < 0 || draft.minNoticeHours > 72)
      found.minNoticeHours = 'Choose between 0 and 72 hours.';
    if (draft.platformFeePercent < 0 || draft.platformFeePercent > 30)
      found.platformFeePercent = 'Choose between 0 and 30 per cent.';

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    updateAdminSettings(draft);
    toast({
      title: 'Settings saved',
      description: 'Stored locally for this demonstration.',
    });
  }

  /**
   * The homepage reads a tutor's own `featured` flag, so this writes both: the
   * settings list is what an administrator sees, and the flag is what the
   * public site renders.
   */
  function toggleFeatured(tutorId: string) {
    const selected = draft.featuredTutorIds.includes(tutorId);
    const featured = selected
      ? draft.featuredTutorIds.filter((id) => id !== tutorId)
      : [...draft.featuredTutorIds, tutorId];
    setDraft({ ...draft, featuredTutorIds: featured });
    updateAdminSettings({ featuredTutorIds: featured });
    setTutorFlags(tutorId, { featured: !selected });
    toast({
      title: selected ? 'Removed from the homepage' : 'Added to the homepage',
      description: 'The featured section updates immediately.',
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform settings"
        lead="Values the marketplace runs on. Everything here is stored locally in this demonstration."
      />

      <form onSubmit={save} noValidate className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">General</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Site name" error={errors.siteName}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  value={draft.siteName}
                  aria-invalid={Boolean(errors.siteName)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    setDraft({ ...draft, siteName: event.target.value })
                  }
                />
              )}
            </Field>
            <Field
              label="Support email"
              hint="Shown on the contact page and in transactional emails."
              error={errors.supportEmail}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="email"
                  value={draft.supportEmail}
                  aria-invalid={Boolean(errors.supportEmail)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    setDraft({ ...draft, supportEmail: event.target.value })
                  }
                />
              )}
            </Field>
            <Field
              label="Safeguarding contact"
              hint="Where escalated reports are sent."
              error={errors.safeguardingContact}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="email"
                  value={draft.safeguardingContact}
                  aria-invalid={Boolean(errors.safeguardingContact)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    setDraft({ ...draft, safeguardingContact: event.target.value })
                  }
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle as="h2">Bookings and fees</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field
              label="Booking window (days)"
              hint="How far ahead a student can book."
              error={errors.bookingWindowDays}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="number"
                  min={1}
                  max={120}
                  value={draft.bookingWindowDays}
                  aria-invalid={Boolean(errors.bookingWindowDays)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    setDraft({ ...draft, bookingWindowDays: Number(event.target.value) })
                  }
                  className="max-w-32"
                />
              )}
            </Field>
            <Field
              label="Minimum notice (hours)"
              hint="How close to the start a lesson can still be booked."
              error={errors.minNoticeHours}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={72}
                  value={draft.minNoticeHours}
                  aria-invalid={Boolean(errors.minNoticeHours)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    setDraft({ ...draft, minNoticeHours: Number(event.target.value) })
                  }
                  className="max-w-32"
                />
              )}
            </Field>
            <Field
              label="Platform fee (%)"
              hint="Added to the tutor's rate at checkout. Payment is not connected in this build."
              error={errors.platformFeePercent}
            >
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  max={30}
                  value={draft.platformFeePercent}
                  aria-invalid={Boolean(errors.platformFeePercent)}
                  aria-describedby={describedBy}
                  onChange={(event) =>
                    setDraft({ ...draft, platformFeePercent: Number(event.target.value) })
                  }
                  className="max-w-32"
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" size="lg">
            Save settings
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle as="h2">Homepage featured tutors</CardTitle>
          <span className="text-ink-subtle text-sm">
            {draft.featuredTutorIds.length} selected
          </span>
        </CardHeader>
        <CardBody>
          <p className="text-ink-muted mb-4 text-sm leading-relaxed">
            Choose which tutors are shown in the featured section. Six works best with the
            three-column layout.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {tutors.map((tutor) => {
              const selected = draft.featuredTutorIds.includes(tutor.id);
              return (
                <li key={tutor.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleFeatured(tutor.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--radius-control)] border p-3 text-left transition-colors duration-[var(--duration-fast)]',
                      selected
                        ? 'border-brand bg-brand-subtle'
                        : 'border-line-strong bg-surface hover:border-ink-subtle',
                    )}
                  >
                    <Avatar
                      firstName={tutor.firstName}
                      lastName={tutor.lastName}
                      tone={tutor.avatarTone}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {tutor.firstName} {tutor.lastName}
                      </span>
                      <span className="text-ink-subtle block text-xs">
                        {subjectName(tutor.subjects[0])} · {tutor.rating.toFixed(1)} ·{' '}
                        {tutor.reviewCount} {pluralise(tutor.reviewCount, 'review')}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
