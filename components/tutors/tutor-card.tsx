'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { Avatar } from '@/components/ui/avatar';
import { Rating } from '@/components/ui/rating';
import { AvailabilityIndicator, VerifiedBadge } from '@/components/ui/badges';
import { ButtonLink } from '@/components/ui/button';
import { FavouriteButton } from './favourite-button';
import { subjectName } from '@/lib/queries';
import { formatPence } from '@/lib/utils';
import type { Tutor } from '@/lib/types';

/**
 * The marketplace's main unit. Hierarchy is name → subject → rating → price →
 * one line of description → availability, because that is the order the
 * decision actually gets made in. Anything longer than a line is clamped so a
 * row of cards keeps a common rhythm.
 */
export function TutorCard({ tutor }: { tutor: Tutor }) {
  const fullName = `${tutor.firstName} ${tutor.lastName}`;

  return (
    <motion.article
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="border-line bg-surface hover:border-line-strong relative flex h-full flex-col rounded-[var(--radius-card)] border p-5 transition-shadow duration-[var(--duration-fast)] hover:shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-3.5">
        <Avatar
          firstName={tutor.firstName}
          lastName={tutor.lastName}
          tone={tutor.avatarTone}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-[1.0625rem] leading-tight font-semibold">
            <Link
              href={`/tutors/${tutor.slug}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {fullName}
            </Link>
          </h3>
          <p className="text-ink-muted mt-1 truncate text-sm">
            {subjectName(tutor.subjects[0])}
            {tutor.subjects[1] ? ` · ${subjectName(tutor.subjects[1])}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular text-lg leading-none font-semibold">
            {formatPence(tutor.hourlyRate)}
          </p>
          <p className="text-ink-subtle mt-1 text-xs whitespace-nowrap">per hour</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Rating value={tutor.rating} count={tutor.reviewCount} size="sm" />
        {tutor.verified && <VerifiedBadge />}
      </div>

      <p className="text-ink-subtle mt-2.5 text-xs">{tutor.levels.join(' · ')}</p>

      <p className="text-ink-muted mt-3 line-clamp-2 text-sm leading-relaxed">
        {tutor.headline}
      </p>

      <div className="mt-auto pt-4">
        <AvailabilityIndicator nextAvailable={tutor.nextAvailable} />
        <div className="relative z-10 mt-3 flex items-center gap-2">
          <ButtonLink
            href={`/tutors/${tutor.slug}`}
            variant="secondary"
            size="sm"
            className="flex-1"
          >
            View profile
          </ButtonLink>
          <ButtonLink href={`/book/${tutor.slug}`} size="sm" className="flex-1">
            Book lesson
          </ButtonLink>
          <FavouriteButton tutorId={tutor.id} tutorName={fullName} size="sm" />
        </div>
      </div>
    </motion.article>
  );
}
