'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Globe,
  MessageSquare,
  Timer,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rating } from '@/components/ui/rating';
import { SubjectBadge, VerifiedBadge } from '@/components/ui/badges';
import { ProgressBar } from '@/components/ui/progress';
import { FavouriteButton } from './favourite-button';
import { DateStrip, TimeGrid } from '@/components/booking/date-picker';
import { generateSlots } from '@/lib/availability';
import { useDemo } from '@/lib/store/demo-store';
import { useRequireAccount } from '@/lib/use-require-account';
import { getRatingBreakdown, subjectName } from '@/lib/queries';
import { formatLongDate, formatRelativeDay, formatTime } from '@/lib/datetime';
import { formatPence, formatResponseTime, pluralise } from '@/lib/utils';
import type { Review, Tutor } from '@/lib/types';

/**
 * The profile is the last screen before a booking decision, so it carries the
 * whole case: who the tutor is, how they teach, what other people said, when
 * they are free, and what happens if you need to cancel.
 */
export function TutorProfile({
  tutor: seed,
  reviews,
}: {
  tutor: Tutor;
  reviews: Review[];
}) {
  const { tutors, getAvailability, getUnavailableDates, startConversation } = useDemo();
  const requireAccount = useRequireAccount();
  const router = useRouter();

  // Prefer the store's copy so a tutor's own profile edits show up immediately.
  const tutor = tutors.find((t) => t.id === seed.id) ?? seed;
  const fullName = `${tutor.firstName} ${tutor.lastName}`;

  const slots = useMemo(
    () =>
      generateSlots({
        availability: getAvailability(tutor.id),
        days: 14,
        unavailableDates: getUnavailableDates(tutor.id),
      }),
    [getAvailability, getUnavailableDates, tutor.id],
  );

  const firstFreeDay = slots.find((day) => day.times.length > 0);
  const [selectedDate, setSelectedDate] = useState<string | null>(
    firstFreeDay?.dateKey ?? null,
  );
  const activeDay = slots.find((day) => day.dateKey === selectedDate);
  const breakdown = getRatingBreakdown(tutor.id);

  function onMessage() {
    requireAccount(() => {
      const id = startConversation(tutor.id);
      router.push(`/messages/${id}`);
    });
  }

  return (
    <div className="pb-28 lg:pb-0">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-line bg-surface border-b">
        <div className="container-page py-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
            <Avatar
              firstName={tutor.firstName}
              lastName={tutor.lastName}
              tone={tutor.avatarTone}
              size="2xl"
              className="hidden sm:inline-flex"
            />
            <Avatar
              firstName={tutor.firstName}
              lastName={tutor.lastName}
              tone={tutor.avatarTone}
              size="xl"
              className="sm:hidden"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-[1.75rem] tracking-[var(--tracking-tight)]">
                  {fullName}
                </h1>
                {tutor.verified && <VerifiedBadge />}
              </div>
              <p className="text-ink-muted mt-2 max-w-2xl leading-relaxed">
                {tutor.headline}
              </p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {tutor.subjects.map((id) => (
                  <SubjectBadge key={id} name={subjectName(id)} tone="brand" />
                ))}
                {tutor.levels.map((level) => (
                  <Badge key={level} tone="outline">
                    {level}
                  </Badge>
                ))}
              </div>

              <dl className="text-ink-muted mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-ink-subtle text-xs">Rating</dt>
                  <dd className="mt-0.5">
                    <Rating value={tutor.rating} count={tutor.reviewCount} size="sm" />
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle text-xs">Lessons taught</dt>
                  <dd className="tabular mt-0.5 font-medium">{tutor.lessonsCompleted}</dd>
                </div>
                <div>
                  <dt className="text-ink-subtle text-xs">Usually replies in</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatResponseTime(tutor.responseTimeMins)}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-subtle text-xs">Location</dt>
                  <dd className="mt-0.5 flex items-center gap-1.5 font-medium">
                    <Globe className="size-4" aria-hidden />
                    Online
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <div className="container-page py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-10">
        {/* ── Main column ──────────────────────────────────────────────── */}
        <div className="space-y-10">
          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-xl">
              About {tutor.firstName}
            </h2>
            <p className="text-ink-muted mt-3 leading-relaxed">{tutor.about}</p>
          </section>

          <section aria-labelledby="approach-heading">
            <h2 id="approach-heading" className="text-xl">
              How lessons work
            </h2>
            <p className="text-ink-muted mt-3 leading-relaxed">
              {tutor.teachingApproach}
            </p>
          </section>

          <section aria-labelledby="subjects-heading">
            <h2 id="subjects-heading" className="text-xl">
              Subjects and levels
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {tutor.subjects.map((id) => (
                <li
                  key={id}
                  className="border-line bg-surface flex items-start gap-3 rounded-[var(--radius-card)] border p-4"
                >
                  <CheckCircle2
                    className="text-success mt-0.5 size-4.5 shrink-0"
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium">{subjectName(id)}</p>
                    <p className="text-ink-subtle mt-0.5 text-sm">
                      {tutor.levels.join(' · ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="quals-heading">
            <h2 id="quals-heading" className="text-xl">
              Qualifications
            </h2>
            <ul className="mt-4 space-y-3">
              {tutor.qualifications.map((qualification) => (
                <li key={qualification.title} className="flex gap-3">
                  <span className="bg-brand-subtle text-brand flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                    <Award className="size-4.5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">{qualification.title}</p>
                    <p className="text-ink-subtle text-sm">
                      {qualification.institution} · {qualification.year}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="experience-heading">
            <h2 id="experience-heading" className="text-xl">
              Experience
            </h2>
            <ul className="mt-4 space-y-4">
              {tutor.experience.map((entry) => (
                <li key={`${entry.role}-${entry.period}`} className="flex gap-3">
                  <span className="bg-mint text-mint-ink flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                    <BriefcaseBusiness className="size-4.5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">{entry.role}</p>
                    <p className="text-ink-subtle text-sm">
                      {entry.organisation} · {entry.period}
                    </p>
                    <p className="text-ink-muted mt-1 text-sm leading-relaxed">
                      {entry.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="availability-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="availability-heading" className="text-xl">
                Availability
              </h2>
              <p className="text-ink-subtle text-sm">
                Next two weeks · times shown in UTC
              </p>
            </div>
            <Card className="mt-4 p-4">
              <DateStrip
                slots={slots}
                selectedDate={selectedDate}
                onSelect={setSelectedDate}
              />
              <div className="mt-4">
                {activeDay ? (
                  <>
                    <p className="text-ink-subtle mb-3 text-sm">
                      {formatLongDate(activeDay.dateIso)}
                    </p>
                    <TimeGrid
                      times={activeDay.times.slice(0, 8)}
                      selected={null}
                      onSelect={(iso) =>
                        router.push(
                          `/book/${tutor.slug}?start=${encodeURIComponent(iso)}`,
                        )
                      }
                    />
                  </>
                ) : (
                  <p className="text-ink-subtle text-sm">
                    {tutor.firstName} has no open slots in the next two weeks. Send a
                    message to ask about later dates.
                  </p>
                )}
              </div>
            </Card>
          </section>

          <section aria-labelledby="reviews-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 id="reviews-heading" className="text-xl">
                Reviews
              </h2>
              <p className="text-ink-subtle text-sm">
                From students and parents after a completed lesson
              </p>
            </div>

            <Card className="mt-4 p-5">
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <p className="tabular text-3xl font-semibold">
                    {tutor.rating.toFixed(1)}
                  </p>
                  <Rating
                    value={tutor.rating}
                    showCount={false}
                    size="sm"
                    className="mt-1"
                  />
                  <p className="text-ink-subtle mt-1 text-sm">
                    {tutor.reviewCount} {pluralise(tutor.reviewCount, 'review')}
                  </p>
                </div>
                <ul className="min-w-[12rem] flex-1 space-y-1.5">
                  {breakdown.map((row) => (
                    <li key={row.stars} className="flex items-center gap-3">
                      <span className="text-ink-subtle tabular w-8 text-xs">
                        {row.stars} ★
                      </span>
                      <ProgressBar
                        value={row.share}
                        label={`${row.share}% of reviews gave ${row.stars} stars`}
                        tone="warning"
                        className="flex-1"
                      />
                      <span className="text-ink-subtle tabular w-9 text-right text-xs">
                        {row.share}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <ul className="mt-4 space-y-3">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </ul>
          </section>

          <section aria-labelledby="policies-heading">
            <h2 id="policies-heading" className="text-xl">
              {tutor.firstName}’s policies
            </h2>
            <ul className="mt-4 space-y-2.5">
              {tutor.policies.map((policy) => (
                <li key={policy} className="text-ink-muted flex gap-2.5 text-sm">
                  <CheckCircle2
                    className="text-ink-subtle mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  {policy}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Booking rail (desktop) ───────────────────────────────────── */}
        <aside className="mt-10 hidden lg:mt-0 lg:block">
          <Card className="sticky top-24 p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-baseline gap-2">
              <span className="tabular text-2xl font-semibold">
                {formatPence(tutor.hourlyRate)}
              </span>
              <span className="text-ink-subtle text-sm">per hour</span>
            </div>

            <dl className="text-ink-muted mt-4 space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-ink-subtle size-4" aria-hidden />
                <dt className="sr-only">Next available</dt>
                <dd>
                  Next free {formatRelativeDay(tutor.nextAvailable).toLowerCase()} at{' '}
                  {formatTime(tutor.nextAvailable)}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Timer className="text-ink-subtle size-4" aria-hidden />
                <dt className="sr-only">Response time</dt>
                <dd>Usually replies in {formatResponseTime(tutor.responseTimeMins)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Users className="text-ink-subtle size-4" aria-hidden />
                <dt className="sr-only">Lessons taught</dt>
                <dd>{tutor.lessonsCompleted} lessons taught on Tutor Hub</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2.5">
              <ButtonLink href={`/book/${tutor.slug}`} size="lg" block>
                Book a lesson
              </ButtonLink>
              <Button variant="secondary" size="lg" block onClick={onMessage}>
                <MessageSquare className="size-4" aria-hidden />
                Message {tutor.firstName}
              </Button>
              <FavouriteButton
                tutorId={tutor.id}
                tutorName={fullName}
                withLabel
                className="w-full"
              />
            </div>

            <p className="text-ink-subtle mt-4 text-xs leading-relaxed">
              You are not charged when you send a request. Payment is not connected in
              this demonstration build.
            </p>
          </Card>
        </aside>
      </div>

      {/* ── Booking bar (mobile) ───────────────────────────────────────── */}
      <div className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0">
            <p className="tabular text-lg leading-none font-semibold">
              {formatPence(tutor.hourlyRate)}
            </p>
            <p className="text-ink-subtle mt-1 text-xs">per hour · online</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <FavouriteButton tutorId={tutor.id} tutorName={fullName} />
            <Button variant="secondary" onClick={onMessage} className="px-3">
              <MessageSquare className="size-[18px]" aria-hidden />
              <span className="sr-only">Message {tutor.firstName}</span>
            </Button>
            <ButtonLink href={`/book/${tutor.slug}`}>Book lesson</ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Long reviews are clipped to four lines with a real disclosure control. */
function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const long = review.body.length > 190;

  return (
    <li className="border-line bg-surface rounded-[var(--radius-card)] border p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-2.5">
          <Avatar
            firstName={review.authorName}
            lastName={review.authorName.split(' ')[1] ?? ''}
            tone={review.rating}
            size="xs"
          />
          <div>
            <p className="text-sm font-medium">{review.authorName}</p>
            <p className="text-ink-subtle text-xs">
              {review.authorRole} · {review.subject} {review.level}
            </p>
          </div>
        </div>
        <Rating value={review.rating} showCount={false} size="sm" />
      </div>

      <p
        className={`text-ink-muted mt-3 text-sm leading-relaxed ${
          long && !expanded ? 'line-clamp-3' : ''
        }`}
      >
        {review.body}
      </p>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-ink-subtle text-xs">{formatLongDate(review.createdAt)}</p>
        {long && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="text-brand text-sm font-medium hover:underline"
          >
            {expanded ? 'Show less' : 'Read full review'}
          </button>
        )}
      </div>
    </li>
  );
}
