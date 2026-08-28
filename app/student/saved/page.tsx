'use client';

import { Heart } from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';
import { TutorCard } from '@/components/tutors/tutor-card';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { ButtonLink } from '@/components/ui/button';
import { useDemo } from '@/lib/store/demo-store';
import { pluralise } from '@/lib/utils';

export default function SavedTutorsPage() {
  const { favourites, tutors, hydrated } = useDemo();

  if (!hydrated) return <Skeleton className="h-96 w-full" />;

  const saved = favourites
    .map((id) => tutors.find((tutor) => tutor.id === id))
    .filter((tutor): tutor is NonNullable<typeof tutor> => Boolean(tutor));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Saved tutors"
        lead={
          saved.length
            ? `${saved.length} ${pluralise(saved.length, 'tutor')} shortlisted. Saved on this device — signing in on another will sync them once accounts are live.`
            : 'Shortlist tutors while you compare them.'
        }
        action={
          <ButtonLink href="/tutors" variant="secondary">
            Browse tutors
          </ButtonLink>
        }
      />

      {saved.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-6" aria-hidden />}
          title="Nothing saved yet"
          body="Tap the heart on a tutor card or profile to add them here. It is the quickest way to compare two or three before booking."
          action={{ label: 'Find a tutor', href: '/tutors' }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {saved.map((tutor) => (
            <TutorCard key={tutor.id} tutor={tutor} />
          ))}
        </div>
      )}
    </div>
  );
}
