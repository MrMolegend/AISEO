/**
 * The read boundary for demo data.
 *
 * Pages and components call these functions instead of importing the arrays in
 * `lib/data` directly. When Supabase arrives, the bodies become queries and the
 * signatures become async — no component changes shape.
 *
 * Mutable state (bookings the visitor made, messages they sent, favourites,
 * application decisions) lives in `lib/store/demo-store.tsx`, which layers its
 * local changes on top of what is returned here.
 */
import { subjects } from '@/lib/data/subjects';
import { tutors } from '@/lib/data/tutors';
import { reviews } from '@/lib/data/reviews';
import { accounts, learners } from '@/lib/data/people';
import { bookings } from '@/lib/data/bookings';
import { conversations } from '@/lib/data/conversations';
import { applications } from '@/lib/data/applications';
import { reports } from '@/lib/data/reports';
import { notifications } from '@/lib/data/notifications';
import { progress } from '@/lib/data/progress';
import { DAY } from '@/lib/datetime';
import type {
  Account,
  Booking,
  Conversation,
  Learner,
  Notification,
  PlatformReport,
  ProgressEntry,
  Review,
  Role,
  Subject,
  Tutor,
  TutorApplication,
  TutorFilters,
  TutorSort,
} from '@/lib/types';

/* ── Subjects ─────────────────────────────────────────────────────────────── */

export function getSubjects(): Subject[] {
  return subjects;
}

/** The ten shown on the homepage; the rest are reachable from the marketplace. */
export function getPopularSubjects(): Subject[] {
  return subjects.slice(0, 10);
}

export function getSubject(id: string | undefined): Subject | undefined {
  return id ? subjects.find((s) => s.id === id) : undefined;
}

export function getSubjectBySlug(slug: string): Subject | undefined {
  return subjects.find((s) => s.slug === slug);
}

export function subjectName(id: string | undefined): string {
  return getSubject(id)?.name ?? 'Lesson';
}

/* ── Tutors ───────────────────────────────────────────────────────────────── */

export function getTutors(): Tutor[] {
  return tutors;
}

export function getTutor(id: string | undefined): Tutor | undefined {
  return id ? tutors.find((t) => t.id === id) : undefined;
}

export function getTutorBySlug(slug: string): Tutor | undefined {
  return tutors.find((t) => t.slug === slug);
}

export function getFeaturedTutors(limit = 6): Tutor[] {
  return tutors.filter((t) => t.featured).slice(0, limit);
}

export function tutorName(id: string | undefined): string {
  const tutor = getTutor(id);
  return tutor ? `${tutor.firstName} ${tutor.lastName}` : 'Tutor';
}

/** Cheapest hourly rate on the marketplace — used for the filter bounds. */
export const priceBounds = {
  min: Math.floor(Math.min(...tutors.map((t) => t.hourlyRate)) / 100),
  max: Math.ceil(Math.max(...tutors.map((t) => t.hourlyRate)) / 100),
};

export const defaultFilters: TutorFilters = {
  query: '',
  subject: null,
  level: null,
  minPrice: priceBounds.min,
  maxPrice: priceBounds.max,
  minRating: 0,
  availableWithinDays: null,
  verifiedOnly: false,
  sort: 'recommended',
};

/** Fields the free-text search looks at, built once per tutor. */
function searchCorpus(tutor: Tutor): string {
  const subjectNames = tutor.subjects.map((id) => subjectName(id)).join(' ');
  return [
    tutor.firstName,
    tutor.lastName,
    tutor.headline,
    tutor.about,
    subjectNames,
    tutor.levels.join(' '),
    tutor.qualifications.map((q) => `${q.title} ${q.institution}`).join(' '),
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Pure filter + sort. Kept free of React and of the store so it can be unit
 * tested directly — see `tests/unit/tutor-filters.test.ts`.
 */
export function filterTutors(
  all: Tutor[],
  filters: TutorFilters,
  now = Date.now(),
): Tutor[] {
  const query = filters.query.trim().toLowerCase();

  const matched = all.filter((tutor) => {
    if (query && !searchCorpus(tutor).includes(query)) return false;
    if (filters.subject && !tutor.subjects.includes(filters.subject)) return false;
    if (filters.level && !tutor.levels.includes(filters.level)) return false;

    const pounds = tutor.hourlyRate / 100;
    if (pounds < filters.minPrice || pounds > filters.maxPrice) return false;
    if (tutor.rating < filters.minRating) return false;
    if (filters.verifiedOnly && !tutor.verified) return false;

    if (filters.availableWithinDays !== null) {
      const withinMs = filters.availableWithinDays * DAY;
      if (new Date(tutor.nextAvailable).getTime() - now > withinMs) return false;
    }

    return true;
  });

  return sortTutors(matched, filters.sort);
}

export function sortTutors(list: Tutor[], sort: TutorSort): Tutor[] {
  const sorted = [...list];
  switch (sort) {
    case 'rating':
      return sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    case 'price-asc':
      return sorted.sort((a, b) => a.hourlyRate - b.hourlyRate);
    case 'price-desc':
      return sorted.sort((a, b) => b.hourlyRate - a.hourlyRate);
    case 'soonest':
      return sorted.sort(
        (a, b) =>
          new Date(a.nextAvailable).getTime() - new Date(b.nextAvailable).getTime(),
      );
    case 'recommended':
    default:
      // Verification first, then a blend of rating and volume, so a 4.9 with
      // 214 reviews outranks a 5.0 with three.
      return sorted.sort((a, b) => {
        if (a.verified !== b.verified) return a.verified ? -1 : 1;
        return score(b) - score(a);
      });
  }
}

function score(tutor: Tutor): number {
  return (
    tutor.rating * 10 + Math.log10(tutor.reviewCount + 1) * 3 + (tutor.featured ? 2 : 0)
  );
}

export function countActiveFilters(filters: TutorFilters): number {
  let count = 0;
  if (filters.query.trim()) count += 1;
  if (filters.subject) count += 1;
  if (filters.level) count += 1;
  if (filters.minPrice > priceBounds.min || filters.maxPrice < priceBounds.max)
    count += 1;
  if (filters.minRating > 0) count += 1;
  if (filters.availableWithinDays !== null) count += 1;
  if (filters.verifiedOnly) count += 1;
  return count;
}

/** Tutors teaching any of the given subjects, best first. */
export function getRecommendedTutors(
  subjectIds: string[] | undefined,
  exclude: string[] = [],
  limit = 3,
): Tutor[] {
  const wanted = subjectIds?.length ? subjectIds : ['maths'];
  const matches = tutors.filter(
    (t) => !exclude.includes(t.id) && t.subjects.some((s) => wanted.includes(s)),
  );
  return sortTutors(matches, 'recommended').slice(0, limit);
}

/* ── Reviews ──────────────────────────────────────────────────────────────── */

export function getReviewsForTutor(tutorId: string): Review[] {
  return reviews
    .filter((r) => r.tutorId === tutorId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getRatingBreakdown(tutorId: string): { stars: number; share: number }[] {
  const list = getReviewsForTutor(tutorId);
  if (list.length === 0) return [];
  return [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    share: Math.round(
      (list.filter((r) => Math.round(r.rating) === stars).length / list.length) * 100,
    ),
  }));
}

/* ── People ───────────────────────────────────────────────────────────────── */

export function getAccounts(): Account[] {
  return accounts;
}

export function getAccount(id: string | undefined): Account | undefined {
  return id ? accounts.find((a) => a.id === id) : undefined;
}

export function getAccountsByRole(role: Role): Account[] {
  return accounts.filter((a) => a.role === role);
}

export function getLearners(parentId: string): Learner[] {
  return learners.filter((l) => l.parentId === parentId);
}

export function getLearner(id: string | undefined): Learner | undefined {
  return id ? learners.find((l) => l.id === id) : undefined;
}

/** Display name for whoever a booking is for — the learner, or the booker. */
export function bookingLearnerName(booking: Booking): string {
  const learner = getLearner(booking.learnerId);
  if (learner) return `${learner.firstName} ${learner.lastName}`;
  const account = getAccount(booking.bookedById);
  return account ? `${account.firstName} ${account.lastName}` : 'Student';
}

/* ── Seed collections ─────────────────────────────────────────────────────── */

export function getSeedBookings(): Booking[] {
  return bookings;
}

export function getSeedConversations(): Conversation[] {
  return conversations;
}

export function getSeedApplications(): TutorApplication[] {
  return applications;
}

export function getSeedReports(): PlatformReport[] {
  return reports;
}

export function getNotificationsForRole(role: Role): Notification[] {
  return notifications
    .filter((n) => n.roles.includes(role))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export function getProgressFor(learnerId: string): ProgressEntry[] {
  return progress.filter((p) => p.learnerId === learnerId);
}
