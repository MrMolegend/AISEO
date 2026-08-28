import type { TutorApplication } from '@/lib/types';
import { at } from '@/lib/datetime';

/**
 * Applications waiting in the admin queue. An application submitted through
 * `/become-a-tutor` is added to this list in the demo store, and the admin
 * decision updates its status locally.
 */
export const applications: TutorApplication[] = [
  {
    id: 'app-201',
    firstName: 'Ravi',
    lastName: 'Chandra',
    email: 'ravi.chandra@example.com',
    phone: '07700 900112',
    location: 'Leicester',
    headline: 'A-Level Physics and Maths, ten years in the classroom',
    subjects: ['physics', 'maths'],
    levels: ['GCSE', 'A-Level'],
    hourlyRate: 4000,
    yearsExperience: 10,
    experience:
      'Ten years teaching Physics at a large sixth-form college, four of them as Key Stage 5 coordinator. I have taught OCR A, AQA and Edexcel specifications and have run the college Physics Olympiad group since 2019.',
    qualifications:
      'MPhys Physics, University of Nottingham (2013). PGCE Secondary Science, University of Birmingham (2014). Enhanced DBS held through my current employer.',
    approach:
      'I start with a short diagnostic on the topic in question, because students rarely fail at the topic they think they are failing at. Lessons then move quickly between explanation and practice, with the student doing most of the work.',
    availabilitySummary: 'Weekday evenings after 17:00, plus Saturday mornings.',
    status: 'under-review',
    submittedAt: at(-1, 20, 15),
    timeline: [
      { at: at(-1, 20, 15), label: 'Application submitted', by: 'Ravi Chandra' },
      { at: at(-1, 20, 16), label: 'Automatic checks passed', by: 'Tutor Hub' },
    ],
    internalNotes: [],
    avatarTone: 1,
  },
  {
    id: 'app-202',
    firstName: 'Grace',
    lastName: 'Mensah',
    email: 'grace.mensah@example.com',
    phone: '07700 900431',
    location: 'Bristol',
    headline: 'GCSE and A-Level Biology, examiner for a major board',
    subjects: ['biology'],
    levels: ['GCSE', 'A-Level'],
    hourlyRate: 4400,
    yearsExperience: 8,
    experience:
      'Currently second in Science at a Bristol academy. I have marked A-Level Biology Paper 1 for four series and lead our department on the practical endorsement.',
    qualifications:
      'BSc Biological Sciences, University of Exeter (2015). PGCE, University of Bristol (2016). Examiner training completed 2020.',
    approach:
      'Biology students lose marks on command words more than on content. I teach the language of the mark scheme alongside the subject itself.',
    availabilitySummary: 'Tuesday and Thursday evenings, Sunday afternoons.',
    status: 'under-review',
    submittedAt: at(-3, 12, 40),
    timeline: [
      { at: at(-3, 12, 40), label: 'Application submitted', by: 'Grace Mensah' },
      { at: at(-3, 12, 41), label: 'Automatic checks passed', by: 'Tutor Hub' },
      { at: at(-2, 9, 15), label: 'Assigned for review', by: 'Dan Foster' },
    ],
    internalNotes: [
      {
        at: at(-2, 9, 20),
        author: 'Dan Foster',
        body: 'Strong application. Waiting on confirmation of the examiner role before approving.',
      },
    ],
    avatarTone: 3,
  },
  {
    id: 'app-203',
    firstName: 'Oliver',
    lastName: 'Nash',
    email: 'oliver.nash@example.com',
    phone: '07700 900556',
    location: 'Newcastle upon Tyne',
    headline: 'Undergraduate maths student offering GCSE support',
    subjects: ['maths'],
    levels: ['GCSE'],
    hourlyRate: 2000,
    yearsExperience: 1,
    experience:
      'Second-year Mathematics undergraduate. I have volunteered as a peer tutor at the university maths support centre for a year and tutored two GCSE students privately.',
    qualifications:
      'A-Levels: Maths A*, Further Maths A, Physics A (2023). Currently studying BSc Mathematics.',
    approach:
      'Lots of practice questions, and I try to keep the atmosphere relaxed because most of the students I have worked with are anxious about the subject.',
    availabilitySummary: 'Weekday afternoons outside lectures, and most weekends.',
    status: 'information-requested',
    submittedAt: at(-8, 16, 5),
    timeline: [
      { at: at(-8, 16, 5), label: 'Application submitted', by: 'Oliver Nash' },
      { at: at(-7, 10, 30), label: 'Information requested', by: 'Dan Foster' },
    ],
    internalNotes: [
      {
        at: at(-7, 10, 32),
        author: 'Dan Foster',
        body: 'Asked for a reference from the university maths support centre and proof of enrolment.',
      },
    ],
    avatarTone: 0,
  },
  {
    id: 'app-204',
    firstName: 'Beatrice',
    lastName: 'Lam',
    email: 'beatrice.lam@example.com',
    phone: '07700 900778',
    location: 'London',
    headline: 'A-Level and undergraduate Economics, former central bank analyst',
    subjects: ['economics', 'statistics'],
    levels: ['A-Level', 'University', 'Adult'],
    hourlyRate: 5000,
    yearsExperience: 4,
    experience:
      'Four years tutoring alongside a career as an economic analyst. I work mostly with A-Level students taking Edexcel A and with first-year undergraduates struggling with quantitative modules.',
    qualifications:
      'MSc Economics, London School of Economics (2018). BSc Economics, University of Bath (2017).',
    approach:
      'Economics is a writing subject with diagrams attached. I spend most of the lesson on argument construction and only as much time on content as the gap requires.',
    availabilitySummary: 'Monday to Thursday, 18:00 onwards.',
    status: 'approved',
    submittedAt: at(-21, 11, 20),
    timeline: [
      { at: at(-21, 11, 20), label: 'Application submitted', by: 'Beatrice Lam' },
      { at: at(-19, 14, 0), label: 'Identity check completed', by: 'Tutor Hub' },
      { at: at(-18, 9, 45), label: 'Approved and published', by: 'Dan Foster' },
    ],
    internalNotes: [
      {
        at: at(-18, 9, 46),
        author: 'Dan Foster',
        body: 'Qualifications verified. Profile live.',
      },
    ],
    avatarTone: 2,
  },
  {
    id: 'app-205',
    firstName: 'Karl',
    lastName: 'Jensen',
    email: 'karl.jensen@example.com',
    phone: '07700 900993',
    location: 'Manchester',
    headline: 'Business and management tuition',
    subjects: ['business'],
    levels: ['A-Level', 'Adult'],
    hourlyRate: 3500,
    yearsExperience: 0,
    experience:
      'I have run a marketing consultancy for six years. This would be my first teaching role and I am keen to move into education.',
    qualifications: 'BA Marketing, Manchester Metropolitan University (2014).',
    approach: 'I would draw on my consultancy work to make the theory concrete.',
    availabilitySummary: 'Flexible.',
    status: 'rejected',
    submittedAt: at(-30, 15, 10),
    timeline: [
      { at: at(-30, 15, 10), label: 'Application submitted', by: 'Karl Jensen' },
      { at: at(-28, 11, 0), label: 'Information requested', by: 'Dan Foster' },
      {
        at: at(-25, 16, 30),
        label: 'Declined — no teaching experience',
        by: 'Dan Foster',
      },
    ],
    internalNotes: [
      {
        at: at(-25, 16, 31),
        author: 'Dan Foster',
        body: 'No teaching or tutoring experience and no exam-board familiarity. Invited to reapply after a term of classroom or tutoring work.',
      },
    ],
    avatarTone: 4,
  },
];
