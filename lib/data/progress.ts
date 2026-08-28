import type { ProgressEntry } from '@/lib/types';
import { at } from '@/lib/datetime';

/**
 * A light record of how a learner is getting on — enough for a parent to see
 * whether tuition is working, and deliberately not a grading system.
 * `learnerId` holds an account id for students who book for themselves.
 */
export const progress: ProgressEntry[] = [
  {
    learnerId: 'u-maya',
    subjectId: 'maths',
    level: 'A-Level',
    lessonsCompleted: 14,
    lessonsPerMonth: 4,
    goal: 'Secure an A in the summer series.',
    confidence: 72,
    lastFeedback:
      'Differentiation is secure now. The chain rule needs to become automatic — it is costing time under exam conditions.',
    lastFeedbackBy: 'Amara Okonkwo',
    lastFeedbackAt: at(-7, 18),
  },
  {
    learnerId: 'u-maya',
    subjectId: 'physics',
    level: 'A-Level',
    lessonsCompleted: 8,
    lessonsPerMonth: 2,
    goal: 'Stop losing marks on unfamiliar Paper 3 contexts.',
    confidence: 58,
    lastFeedback:
      'Diagrams have improved a lot. Two-dimensional collisions are the next gap.',
    lastFeedbackBy: 'Tom Whitfield',
    lastFeedbackAt: at(-11, 17),
  },
  {
    learnerId: 'l-anya',
    subjectId: 'chemistry',
    level: 'GCSE',
    lessonsCompleted: 11,
    lessonsPerMonth: 4,
    goal: 'Grade 7 in the summer series.',
    confidence: 64,
    lastFeedback:
      'Balancing equations is reliable now. Reaction rates next — Anya guesses at the graph shapes rather than reasoning from collision theory.',
    lastFeedbackBy: 'Priya Raghavan',
    lastFeedbackAt: at(-6, 17),
  },
  {
    learnerId: 'l-anya',
    subjectId: 'maths',
    level: 'GCSE',
    lessonsCompleted: 6,
    lessonsPerMonth: 2,
    goal: 'Move from grade 5 to grade 7 on the Higher tier.',
    confidence: 51,
    lastFeedback:
      'Good progress on simultaneous equations; ratio problems still need work.',
    lastFeedbackBy: 'Marcus Bell',
    lastFeedbackAt: at(-12, 18),
  },
  {
    learnerId: 'l-rohan',
    subjectId: 'economics',
    level: 'A-Level',
    lessonsCompleted: 16,
    lessonsPerMonth: 4,
    goal: 'Grade A to meet a firm university offer.',
    confidence: 77,
    lastFeedback:
      'Knowledge and application marks are consistent. Evaluation is thin — two timed 25-markers a week from now on.',
    lastFeedbackBy: 'Callum Fraser',
    lastFeedbackAt: at(-9, 19),
  },
  {
    learnerId: 'l-rohan',
    subjectId: 'maths',
    level: 'A-Level',
    lessonsCompleted: 5,
    lessonsPerMonth: 2,
    goal: 'Keep the Maths grade steady while Economics is the priority.',
    confidence: 68,
    lastFeedback:
      'Comfortable with the pure content; statistics module needs a term of attention.',
    lastFeedbackBy: 'Amara Okonkwo',
    lastFeedbackAt: at(-15, 17),
  },
  {
    learnerId: 'u-ife',
    subjectId: 'computer-science',
    level: 'University',
    lessonsCompleted: 9,
    lessonsPerMonth: 3,
    goal: 'Pass the algorithms module with a 2:1 or better.',
    confidence: 70,
    lastFeedback:
      'Hash tables are clear. Implement open addressing from scratch before we move to graphs.',
    lastFeedbackBy: 'Joseph Adeyemi',
    lastFeedbackAt: at(-13, 20),
  },
  {
    learnerId: 'u-jack',
    subjectId: 'chemistry',
    level: 'GCSE',
    lessonsCompleted: 3,
    lessonsPerMonth: 2,
    goal: 'Build enough confidence to attempt the Higher tier paper.',
    confidence: 42,
    lastFeedback:
      'Early days. Structure of the atom is solid; bonding needs another two lessons.',
    lastFeedbackBy: 'Priya Raghavan',
    lastFeedbackAt: at(-18, 16),
  },
];
