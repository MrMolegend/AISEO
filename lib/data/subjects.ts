import type { Subject } from '@/lib/types';

/**
 * The subject taxonomy. `icon` is a key into the map in
 * `components/subjects/subject-icon.tsx` rather than a component reference, so
 * this file stays a plain data module that a server component can import.
 */
export const subjects: Subject[] = [
  {
    id: 'maths',
    name: 'Mathematics',
    slug: 'mathematics',
    icon: 'maths',
    blurb: 'Algebra, calculus and exam technique from GCSE to first-year degree.',
    levels: ['GCSE', 'A-Level', 'University', 'Adult'],
  },
  {
    id: 'biology',
    name: 'Biology',
    slug: 'biology',
    icon: 'biology',
    blurb: 'Required practicals, six-mark answers and A-Level essay structure.',
    levels: ['GCSE', 'A-Level', 'University'],
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    slug: 'chemistry',
    icon: 'chemistry',
    blurb: 'Moles, organic mechanisms and the maths that trips people up.',
    levels: ['GCSE', 'A-Level', 'University'],
  },
  {
    id: 'physics',
    name: 'Physics',
    slug: 'physics',
    icon: 'physics',
    blurb: 'Mechanics, fields and turning problem-solving into a repeatable method.',
    levels: ['GCSE', 'A-Level', 'University'],
  },
  {
    id: 'english-lit',
    name: 'English Literature',
    slug: 'english-literature',
    icon: 'english',
    blurb: 'Close reading, comparative essays and confident exam timing.',
    levels: ['GCSE', 'A-Level', 'University'],
  },
  {
    id: 'economics',
    name: 'Economics',
    slug: 'economics',
    icon: 'economics',
    blurb: 'Diagram accuracy, evaluation marks and applied context questions.',
    levels: ['A-Level', 'University', 'Adult'],
  },
  {
    id: 'computer-science',
    name: 'Computer Science',
    slug: 'computer-science',
    icon: 'computing',
    blurb: 'Algorithms, data structures and coursework that actually compiles.',
    levels: ['GCSE', 'A-Level', 'University', 'Adult'],
  },
  {
    id: 'psychology',
    name: 'Psychology',
    slug: 'psychology',
    icon: 'psychology',
    blurb: 'Studies, methods and the 16-mark essays that decide the grade.',
    levels: ['A-Level', 'University'],
  },
  {
    id: 'business',
    name: 'Business',
    slug: 'business',
    icon: 'business',
    blurb: 'Case studies, calculations and structured evaluation.',
    levels: ['GCSE', 'A-Level', 'University', 'Adult'],
  },
  {
    id: 'geography',
    name: 'Geography',
    slug: 'geography',
    icon: 'geography',
    blurb: 'Case-study recall, fieldwork write-ups and data response.',
    levels: ['GCSE', 'A-Level'],
  },
  {
    id: 'further-maths',
    name: 'Further Mathematics',
    slug: 'further-mathematics',
    icon: 'maths',
    blurb: 'Complex numbers, matrices and university admissions preparation.',
    levels: ['A-Level', 'University'],
  },
  {
    id: 'statistics',
    name: 'Statistics',
    slug: 'statistics',
    icon: 'statistics',
    blurb: 'Hypothesis testing and data analysis for degree modules and work.',
    levels: ['A-Level', 'University', 'Adult'],
  },
];

export const educationLevels = ['GCSE', 'A-Level', 'University', 'Adult'] as const;

/** Human label for the level filter — "Adult" alone reads oddly in a form. */
export const levelLabels: Record<string, string> = {
  GCSE: 'GCSE',
  'A-Level': 'A-Level',
  University: 'University',
  Adult: 'Adult learner',
};
