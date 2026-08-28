import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingFlow } from '@/components/booking/booking-flow';
import { getTutorBySlug } from '@/lib/queries';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tutor = getTutorBySlug(slug);
  return {
    title: tutor
      ? `Book a lesson with ${tutor.firstName} ${tutor.lastName}`
      : 'Book a lesson',
    robots: { index: false, follow: false },
  };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const tutor = getTutorBySlug(slug);
  if (!tutor) notFound();

  const start = typeof query.start === 'string' ? query.start : undefined;

  return <BookingFlow tutor={tutor} {...(start ? { initialStart: start } : {})} />;
}
