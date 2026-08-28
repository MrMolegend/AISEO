'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Rating } from '@/components/ui/rating';
import {
  AvailabilityIndicator,
  SubjectBadge,
  VerifiedBadge,
} from '@/components/ui/badges';
import { ButtonLink } from '@/components/ui/button';
import { FavouriteButton } from './favourite-button';
import { subjectName } from '@/lib/queries';
import { formatPence, formatResponseTime } from '@/lib/utils';
import type { Tutor } from '@/lib/types';

/** The wide alternative to `TutorCard`, shown when list view is selected. */
export function TutorListRow({ tutor }: { tutor: Tutor }) {
  return (
    <article className="border-line bg-surface hover:border-line-strong relative rounded-[var(--radius-card)] border p-5 transition-colors duration-[var(--duration-fast)]">
      <div className="flex gap-4 sm:gap-5">
        <Avatar
          firstName={tutor.firstName}
          lastName={tutor.lastName}
          tone={tutor.avatarTone}
          size="lg"
          className="hidden sm:inline-flex"
        />
        <Avatar
          firstName={tutor.firstName}
          lastName={tutor.lastName}
          tone={tutor.avatarTone}
          size="md"
          className="sm:hidden"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="text-[1.0625rem] font-semibold">
                  <Link href={`/tutors/${tutor.slug}`} className="hover:text-brand">
                    {tutor.firstName} {tutor.lastName}
                  </Link>
                </h3>
                {tutor.verified && <VerifiedBadge />}
              </div>
              <p className="text-ink-subtle mt-1 text-sm">{tutor.levels.join(' · ')}</p>
            </div>
            <div className="text-right">
              <p className="tabular text-lg font-semibold">
                {formatPence(tutor.hourlyRate)}
              </p>
              <p className="text-ink-subtle text-xs">per hour</p>
            </div>
          </div>

          <p className="text-ink-muted mt-2.5 text-sm leading-relaxed">
            {tutor.headline}
          </p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {tutor.subjects.map((id) => (
              <SubjectBadge key={id} name={subjectName(id)} />
            ))}
          </div>

          <div className="text-ink-subtle mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <Rating value={tutor.rating} count={tutor.reviewCount} size="sm" />
            <span>{tutor.lessonsCompleted} lessons taught</span>
            <span>Replies in {formatResponseTime(tutor.responseTimeMins)}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <AvailabilityIndicator nextAvailable={tutor.nextAvailable} />
            <div className="flex items-center gap-2">
              <FavouriteButton
                tutorId={tutor.id}
                tutorName={`${tutor.firstName} ${tutor.lastName}`}
                size="sm"
              />
              <ButtonLink href={`/tutors/${tutor.slug}`} variant="secondary" size="sm">
                View profile
              </ButtonLink>
              <ButtonLink href={`/book/${tutor.slug}`} size="sm">
                Book
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
