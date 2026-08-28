import type { Metadata } from 'next';
import { Marketplace } from '@/components/tutors/marketplace';
import { defaultFilters, getSubjects, priceBounds } from '@/lib/queries';
import { educationLevels } from '@/lib/data/subjects';
import type { EducationLevel, TutorFilters, TutorSort } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Find a tutor',
  description:
    'Compare tutors for GCSE, A-Level, university and adult study by subject, price, rating and availability.',
};

const SORTS: TutorSort[] = [
  'recommended',
  'rating',
  'price-asc',
  'price-desc',
  'soonest',
];

/**
 * The URL is the source of truth for the initial search, so a link from the
 * homepage or a shared result set lands on exactly the same filters.
 */
export default async function TutorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const read = (key: string): string | undefined => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const subjects = getSubjects();
  const subjectParam = read('subject');
  const levelParam = read('level');
  const sortParam = read('sort');

  const initialFilters: TutorFilters = {
    ...defaultFilters,
    query: read('q') ?? '',
    subject: subjects.some((s) => s.id === subjectParam) ? (subjectParam ?? null) : null,
    level: educationLevels.includes(levelParam as EducationLevel)
      ? (levelParam as EducationLevel)
      : null,
    minPrice: clamp(
      Number(read('min')),
      priceBounds.min,
      priceBounds.max,
      priceBounds.min,
    ),
    maxPrice: clamp(
      Number(read('max')),
      priceBounds.min,
      priceBounds.max,
      priceBounds.max,
    ),
    minRating: clamp(Number(read('rating')), 0, 5, 0),
    availableWithinDays: read('within') ? clamp(Number(read('within')), 1, 30, 7) : null,
    verifiedOnly: read('verified') === '1',
    sort: SORTS.includes(sortParam as TutorSort)
      ? (sortParam as TutorSort)
      : 'recommended',
  };

  return <Marketplace subjects={subjects} initialFilters={initialFilters} />;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
