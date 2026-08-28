import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TutorProfile } from '@/components/tutors/tutor-profile';
import { getReviewsForTutor, getTutorBySlug, subjectName } from '@/lib/queries';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tutor = getTutorBySlug(slug);
  if (!tutor) return { title: 'Tutor not found' };

  return {
    title: `${tutor.firstName} ${tutor.lastName} — ${subjectName(tutor.subjects[0])} tutor`,
    description: tutor.headline,
  };
}

export default async function TutorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tutor = getTutorBySlug(slug);
  if (!tutor) notFound();

  return <TutorProfile tutor={tutor} reviews={getReviewsForTutor(tutor.id)} />;
}
