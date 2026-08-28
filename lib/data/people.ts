import type { Account, Learner } from '@/lib/types';

/**
 * Demo accounts. Signing in picks one of these rather than authenticating —
 * see `lib/store/demo-store.tsx`. Supabase Auth replaces the selection, not the
 * shape.
 */
export const accounts: Account[] = [
  {
    id: 'u-maya',
    role: 'student',
    firstName: 'Maya',
    lastName: 'Bennett',
    email: 'maya.bennett@example.com',
    avatarTone: 2,
    subjects: ['maths', 'physics'],
    level: 'A-Level',
  },
  {
    id: 'u-jack',
    role: 'student',
    firstName: 'Jack',
    lastName: 'Reid',
    email: 'jack.reid@example.com',
    avatarTone: 0,
    subjects: ['chemistry', 'biology'],
    level: 'GCSE',
  },
  {
    id: 'u-ife',
    role: 'student',
    firstName: 'Ife',
    lastName: 'Adebayo',
    email: 'ife.adebayo@example.com',
    avatarTone: 4,
    subjects: ['computer-science', 'statistics'],
    level: 'University',
  },
  {
    id: 'u-sarah',
    role: 'parent',
    firstName: 'Sarah',
    lastName: 'Kaur',
    email: 'sarah.kaur@example.com',
    avatarTone: 1,
    learnerIds: ['l-anya', 'l-rohan'],
  },
  {
    id: 'u-priya-tutor',
    role: 'tutor',
    firstName: 'Priya',
    lastName: 'Raghavan',
    email: 'priya.raghavan@example.com',
    tutorId: 't-priya',
    avatarTone: 2,
  },
  {
    id: 'u-admin',
    role: 'admin',
    firstName: 'Dan',
    lastName: 'Foster',
    email: 'dan.foster@tutorhub.example',
    avatarTone: 3,
  },
];

/** The two learners linked to the parent account. */
export const learners: Learner[] = [
  {
    id: 'l-anya',
    parentId: 'u-sarah',
    firstName: 'Anya',
    lastName: 'Kaur',
    yearGroup: 'Year 11',
    level: 'GCSE',
    subjects: ['maths', 'chemistry'],
    avatarTone: 0,
    goal: 'Grade 7 in Maths and Chemistry by the summer series.',
  },
  {
    id: 'l-rohan',
    parentId: 'u-sarah',
    firstName: 'Rohan',
    lastName: 'Kaur',
    yearGroup: 'Year 13',
    level: 'A-Level',
    subjects: ['economics', 'maths'],
    avatarTone: 3,
    goal: 'A in Economics to meet a firm university offer.',
  },
];

/** Which demo account each role selector lands on. */
export const defaultAccountByRole = {
  student: 'u-maya',
  parent: 'u-sarah',
  tutor: 'u-priya-tutor',
  admin: 'u-admin',
} as const;
