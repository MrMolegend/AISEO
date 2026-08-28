/**
 * The Tutor Hub domain model.
 *
 * These types describe the shape the interface consumes. The demo data layer in
 * `lib/data` satisfies them today; a Supabase client will satisfy them later
 * without any component changing. Nothing in `app/` or `components/` should
 * import a raw array — everything goes through `lib/queries.ts` or the demo
 * store.
 */

export type EducationLevel = 'GCSE' | 'A-Level' | 'University' | 'Adult';

export type Role = 'student' | 'parent' | 'tutor' | 'admin';

export interface Subject {
  id: string;
  name: string;
  slug: string;
  /** Key into the icon map in `components/subjects/subject-icon.tsx`. */
  icon: string;
  /** One-line description used on the subject cards. */
  blurb: string;
  levels: EducationLevel[];
}

export interface Qualification {
  title: string;
  institution: string;
  year: number;
}

export interface ExperienceEntry {
  role: string;
  organisation: string;
  period: string;
  detail: string;
}

/** A recurring weekly slot. `day` is 0 = Sunday, matching `Date#getUTCDay`. */
export interface AvailabilitySlot {
  id: string;
  day: number;
  start: string; // "16:00"
  end: string; // "20:00"
}

export interface Tutor {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  headline: string;
  about: string;
  teachingApproach: string;
  /** Subject ids, most important first. */
  subjects: string[];
  levels: EducationLevel[];
  hourlyRate: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  featured: boolean;
  lessonsCompleted: number;
  /** Typical first-reply time, in minutes. */
  responseTimeMins: number;
  yearsExperience: number;
  qualifications: Qualification[];
  experience: ExperienceEntry[];
  policies: string[];
  availability: AvailabilitySlot[];
  /** ISO instant of the next free slot. */
  nextAvailable: string;
  joinedAt: string;
  /** Background tint index for the initials avatar, 0–4. */
  avatarTone: number;
}

export interface Review {
  id: string;
  tutorId: string;
  authorName: string;
  authorRole: 'Student' | 'Parent';
  rating: number;
  subject: string;
  level: EducationLevel;
  createdAt: string;
  body: string;
}

export interface Account {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  email: string;
  /** Present for tutor accounts: the marketplace profile they own. */
  tutorId?: string;
  /** Present for parent accounts. */
  learnerIds?: string[];
  avatarTone: number;
  /** Subjects the student is currently studying — drives recommendations. */
  subjects?: string[];
  level?: EducationLevel;
}

export interface Learner {
  id: string;
  parentId: string;
  firstName: string;
  lastName: string;
  yearGroup: string;
  level: EducationLevel;
  subjects: string[];
  avatarTone: number;
  goal: string;
}

export type BookingStatus =
  'requested' | 'confirmed' | 'completed' | 'cancelled' | 'reschedule-requested';

export interface Booking {
  id: string;
  reference: string;
  tutorId: string;
  /** Account id of the person who booked. */
  bookedById: string;
  /** Set when a parent books on behalf of a learner. */
  learnerId?: string;
  subjectId: string;
  level: EducationLevel;
  startsAt: string;
  durationMins: number;
  /** Lesson price in pence, before the platform fee. */
  lessonPence: number;
  feePence: number;
  status: BookingStatus;
  note?: string;
  createdAt: string;
  /** Written by the tutor after a completed lesson. */
  tutorFeedback?: string;
  objectives?: string[];
}

export interface Message {
  id: string;
  conversationId: string;
  /** Account id, or a tutor id for messages sent by a tutor. */
  senderId: string;
  body: string;
  sentAt: string;
}

export interface Conversation {
  id: string;
  tutorId: string;
  /** Account id of the student or parent side. */
  memberId: string;
  /** Set when the conversation concerns a specific learner. */
  learnerId?: string;
  /** Booking the conversation is anchored to, if any. */
  bookingId?: string;
  messages: Message[];
  /** Minutes since the tutor was last seen; under 10 renders as "Online". */
  tutorLastSeenMins: number;
}

export type ApplicationStatus =
  'under-review' | 'information-requested' | 'approved' | 'rejected';

export interface ApplicationTimelineEntry {
  at: string;
  label: string;
  by: string;
}

export interface TutorApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  subjects: string[];
  levels: EducationLevel[];
  hourlyRate: number;
  yearsExperience: number;
  experience: string;
  qualifications: string;
  approach: string;
  availabilitySummary: string;
  status: ApplicationStatus;
  submittedAt: string;
  timeline: ApplicationTimelineEntry[];
  internalNotes: { at: string; author: string; body: string }[];
  avatarTone: number;
}

export type ReportStatus = 'open' | 'investigating' | 'resolved' | 'escalated';

export interface PlatformReport {
  id: string;
  reporterName: string;
  reporterRole: Role;
  subjectOfReport: string;
  subjectType: 'tutor' | 'student' | 'lesson' | 'message';
  category: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
}

export interface Notification {
  id: string;
  roles: Role[];
  title: string;
  body: string;
  at: string;
  href: string;
}

export interface ProgressEntry {
  learnerId: string;
  subjectId: string;
  level: EducationLevel;
  lessonsCompleted: number;
  lessonsPerMonth: number;
  goal: string;
  /** 0–100, the tutor's view of progress towards the goal. */
  confidence: number;
  lastFeedback: string;
  lastFeedbackBy: string;
  lastFeedbackAt: string;
}

/** Everything the marketplace can filter and sort on. */
export interface TutorFilters {
  query: string;
  subject: string | null;
  level: EducationLevel | null;
  minPrice: number;
  maxPrice: number;
  minRating: number;
  /** Filters to tutors free within this many days. */
  availableWithinDays: number | null;
  verifiedOnly: boolean;
  sort: TutorSort;
}

export type TutorSort = 'recommended' | 'rating' | 'price-asc' | 'price-desc' | 'soonest';
