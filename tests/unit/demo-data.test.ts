import { describe, expect, it } from 'vitest';
import {
  getAccounts,
  getLearner,
  getSeedApplications,
  getSeedBookings,
  getSeedConversations,
  getSeedReports,
  getSubjects,
  getTutor,
  getTutors,
  getAccount,
} from '@/lib/queries';
import { subjects } from '@/lib/data/subjects';
import { reviews } from '@/lib/data/reviews';
import { progress } from '@/lib/data/progress';

const tutors = getTutors();
const subjectIds = new Set(subjects.map((subject) => subject.id));

describe('tutor data', () => {
  it('has a dozen tutors with unique ids and slugs', () => {
    expect(tutors.length).toBeGreaterThanOrEqual(10);
    expect(new Set(tutors.map((tutor) => tutor.id)).size).toBe(tutors.length);
    expect(new Set(tutors.map((tutor) => tutor.slug)).size).toBe(tutors.length);
  });

  it('only references subjects that exist', () => {
    for (const tutor of tutors) {
      for (const id of tutor.subjects) expect(subjectIds.has(id)).toBe(true);
    }
  });

  it('prices every tutor within a believable UK range', () => {
    for (const tutor of tutors) {
      expect(tutor.hourlyRate).toBeGreaterThanOrEqual(2000);
      expect(tutor.hourlyRate).toBeLessThanOrEqual(6000);
    }
  });

  it('does not give every tutor a perfect rating', () => {
    const perfect = tutors.filter((tutor) => tutor.rating === 5);
    expect(perfect).toHaveLength(0);
    expect(new Set(tutors.map((tutor) => tutor.rating)).size).toBeGreaterThan(4);
  });

  it('includes unverified tutors, so the verified filter does something', () => {
    expect(tutors.some((tutor) => !tutor.verified)).toBe(true);
    expect(tutors.some((tutor) => tutor.verified)).toBe(true);
  });

  it('gives every tutor availability and a next free slot in the future', () => {
    for (const tutor of tutors) {
      expect(tutor.availability.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(tutor.nextAvailable))).toBe(false);
    }
  });

  it('has enough featured tutors to fill the homepage row', () => {
    expect(tutors.filter((tutor) => tutor.featured).length).toBeGreaterThanOrEqual(6);
  });
});

describe('reviews', () => {
  it('belong to a real tutor and are scored one to five', () => {
    for (const review of reviews) {
      expect(getTutor(review.tutorId)).toBeDefined();
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
  });

  it('cover every tutor', () => {
    const covered = new Set(reviews.map((review) => review.tutorId));
    for (const tutor of tutors) expect(covered.has(tutor.id)).toBe(true);
  });
});

describe('bookings', () => {
  const bookings = getSeedBookings();

  it('cover every status the interface can render', () => {
    const statuses = new Set(bookings.map((booking) => booking.status));
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('cancelled');
    expect(statuses).toContain('requested');
    expect(statuses).toContain('reschedule-requested');
  });

  it('reference a real tutor, account, subject and — where set — learner', () => {
    for (const booking of bookings) {
      expect(getTutor(booking.tutorId)).toBeDefined();
      expect(getAccount(booking.bookedById)).toBeDefined();
      expect(subjectIds.has(booking.subjectId)).toBe(true);
      if (booking.learnerId) expect(getLearner(booking.learnerId)).toBeDefined();
    }
  });

  it('price the lesson from the tutor’s rate and add a fee on top', () => {
    for (const booking of bookings) {
      const tutor = getTutor(booking.tutorId);
      expect(booking.lessonPence).toBe(
        Math.round(((tutor?.hourlyRate ?? 0) * booking.durationMins) / 60),
      );
      expect(booking.feePence).toBeGreaterThan(0);
      expect(booking.feePence).toBeLessThan(booking.lessonPence);
    }
  });

  it('use unique references', () => {
    const references = bookings.map((booking) => booking.reference);
    expect(new Set(references).size).toBe(references.length);
  });
});

describe('conversations', () => {
  it('are between a real tutor and a real account', () => {
    for (const conversation of getSeedConversations()) {
      expect(getTutor(conversation.tutorId)).toBeDefined();
      expect(getAccount(conversation.memberId)).toBeDefined();
    }
  });

  it('are in chronological order within a thread', () => {
    for (const conversation of getSeedConversations()) {
      const times = conversation.messages.map((message) => Date.parse(message.sentAt));
      expect([...times].sort((a, b) => a - b)).toEqual(times);
    }
  });

  it('are sent by someone in the conversation', () => {
    for (const conversation of getSeedConversations()) {
      for (const message of conversation.messages) {
        expect([conversation.tutorId, conversation.memberId]).toContain(message.senderId);
      }
    }
  });
});

describe('applications, reports and progress', () => {
  it('cover every application status', () => {
    const statuses = new Set(getSeedApplications().map((item) => item.status));
    expect(statuses).toContain('under-review');
    expect(statuses).toContain('information-requested');
    expect(statuses).toContain('approved');
    expect(statuses).toContain('rejected');
  });

  it('give each application a timeline and valid subjects', () => {
    for (const application of getSeedApplications()) {
      expect(application.timeline.length).toBeGreaterThan(0);
      for (const id of application.subjects) expect(subjectIds.has(id)).toBe(true);
    }
  });

  it('cover every report status', () => {
    const statuses = new Set(getSeedReports().map((report) => report.status));
    expect(statuses.size).toBeGreaterThanOrEqual(3);
  });

  it('record progress against a real learner or student account', () => {
    for (const entry of progress) {
      const isLearner = Boolean(getLearner(entry.learnerId));
      const isAccount = Boolean(getAccount(entry.learnerId));
      expect(isLearner || isAccount).toBe(true);
      expect(entry.confidence).toBeGreaterThanOrEqual(0);
      expect(entry.confidence).toBeLessThanOrEqual(100);
    }
  });
});

describe('accounts', () => {
  it('include one of each role', () => {
    const roles = new Set(getAccounts().map((account) => account.role));
    expect(roles).toEqual(new Set(['student', 'parent', 'tutor', 'admin']));
  });

  it('link the tutor account to a marketplace profile', () => {
    const tutorAccount = getAccounts().find((account) => account.role === 'tutor');
    expect(getTutor(tutorAccount?.tutorId)).toBeDefined();
  });

  it('give the parent account two linked learners', () => {
    const parent = getAccounts().find((account) => account.role === 'parent');
    expect(parent?.learnerIds).toHaveLength(2);
  });
});

describe('subjects', () => {
  it('have unique ids and slugs and at least one level each', () => {
    const all = getSubjects();
    expect(new Set(all.map((subject) => subject.id)).size).toBe(all.length);
    expect(new Set(all.map((subject) => subject.slug)).size).toBe(all.length);
    for (const subject of all) expect(subject.levels.length).toBeGreaterThan(0);
  });
});
