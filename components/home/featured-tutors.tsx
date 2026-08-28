'use client';

import { TutorCard } from '@/components/tutors/tutor-card';
import { TutorCardSkeleton } from '@/components/ui/states';
import { useDemo } from '@/lib/store/demo-store';
import type { Tutor } from '@/lib/types';

/**
 * Reads the featured set from the store rather than the seed array, so an
 * administrator toggling "featured" is visible on the homepage straight away.
 * The server-rendered `fallback` keeps the section filled before hydration.
 */
export function FeaturedTutors({ fallback }: { fallback: Tutor[] }) {
  const { tutors, hydrated, isSuspended } = useDemo();

  const featured = hydrated
    ? tutors.filter((tutor) => tutor.featured && !isSuspended(tutor.id)).slice(0, 6)
    : fallback;

  if (featured.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <TutorCardSkeleton key={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {featured.map((tutor) => (
        <TutorCard key={tutor.id} tutor={tutor} />
      ))}
    </div>
  );
}
