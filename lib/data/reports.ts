import type { PlatformReport } from '@/lib/types';
import { at } from '@/lib/datetime';

export const reports: PlatformReport[] = [
  {
    id: 'rep-51',
    reporterName: 'Sarah Kaur',
    reporterRole: 'parent',
    subjectOfReport: 'Lesson TH-4801',
    subjectType: 'lesson',
    category: 'Lesson did not start',
    details:
      'The tutor joined eleven minutes late and the lesson still ended at the scheduled time. Asking whether the missing time can be credited.',
    status: 'open',
    createdAt: at(-1, 21, 5),
  },
  {
    id: 'rep-52',
    reporterName: 'Jack Reid',
    reporterRole: 'student',
    subjectOfReport: 'Marcus Bell',
    subjectType: 'tutor',
    category: 'Contact outside the platform',
    details:
      'Tutor suggested moving lessons to a personal email address to avoid the platform fee.',
    status: 'investigating',
    createdAt: at(-2, 17, 40),
  },
  {
    id: 'rep-53',
    reporterName: 'Priya Raghavan',
    reporterRole: 'tutor',
    subjectOfReport: 'Message thread with u-ife',
    subjectType: 'message',
    category: 'Inappropriate request',
    details:
      'Student asked me to complete a piece of assessed coursework on their behalf. I declined and explained the policy.',
    status: 'resolved',
    createdAt: at(-9, 13, 15),
  },
  {
    id: 'rep-54',
    reporterName: 'Helen Roberts',
    reporterRole: 'parent',
    subjectOfReport: 'Daniel Osei',
    subjectType: 'tutor',
    category: 'Profile accuracy',
    details:
      'Profile lists a qualification that does not appear on the certificate provided when we asked. Requesting verification.',
    status: 'escalated',
    createdAt: at(-4, 10, 25),
  },
  {
    id: 'rep-55',
    reporterName: 'Ife Adebayo',
    reporterRole: 'student',
    subjectOfReport: 'Lesson TH-4760',
    subjectType: 'lesson',
    category: 'Billing query',
    details:
      'Charged for 90 minutes; the lesson ran for 75. Requesting a partial refund.',
    status: 'open',
    createdAt: at(-3, 9, 50),
  },
];
