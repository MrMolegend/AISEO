import type { Metadata } from 'next';
import { PolicyPage } from '@/components/marketing/policy-page';

export const metadata: Metadata = {
  title: 'Terms of use',
  description:
    'The rules for using Tutor Hub — booking lessons, teaching on the platform, payments and cancellations.',
};

export default function TermsPage() {
  return (
    <PolicyPage
      title="Terms of use"
      lead="What you can expect from Tutor Hub, and what Tutor Hub expects from you."
      updated="August 2026"
      sections={[
        {
          heading: 'What Tutor Hub is',
          paragraphs: [
            'Tutor Hub is a marketplace. It introduces students and parents to independent tutors, handles scheduling, messaging, payment and the lesson room, and sets the standards a tutor has to meet to appear here.',
            'Tutors are not employed by Tutor Hub. They set their own rates, their own hours and their own lesson policies, and they are responsible for the teaching itself.',
          ],
        },
        {
          heading: 'Accounts',
          paragraphs: [
            'You need an account to book a lesson or to teach. You must give accurate information, keep your sign-in details to yourself, and be old enough to hold an account in your own name — a parent or carer holds the account for younger learners.',
          ],
        },
        {
          heading: 'Booking and paying for lessons',
          paragraphs: [
            'Booking a lesson creates an agreement between you and the tutor. The price shown at checkout is the tutor’s rate for the length you chose, plus the Tutor Hub service fee, which is displayed separately.',
            'Payment is taken when you book and held until the lesson has taken place. Tutors are paid afterwards. In this demonstration build no payment is taken at all.',
          ],
        },
        {
          heading: 'Cancellations and rescheduling',
          paragraphs: [
            'Each tutor sets their own notice period, shown on their profile — usually 24 hours. Cancel with more than that notice and you are not charged. Inside the notice period the tutor may charge for the lesson.',
            'If a tutor cancels, or does not arrive, you are not charged and Tutor Hub will help you find an alternative.',
          ],
        },
        {
          heading: 'Behaviour on the platform',
          paragraphs: [
            'Keep lessons and messages on Tutor Hub. Moving off the platform removes the protections that exist for both sides, and asking someone to do so is a breach of these terms.',
          ],
          list: [
            'Do not ask a tutor to complete assessed work on your behalf, and do not agree to do so.',
            'Do not share another person’s contact details or personal information.',
            'Do not record a lesson without the agreement of everyone in it.',
            'Treat everyone civilly. Abuse, harassment or discrimination ends an account.',
          ],
        },
        {
          heading: 'Reviews',
          paragraphs: [
            'Only a student or parent who has completed a booked lesson can leave a review. Reviews must describe your own experience. We remove reviews that are abusive, contain personal information, or were not written by someone who had the lesson.',
          ],
        },
        {
          heading: 'Ending an account',
          paragraphs: [
            'You can close your account at any time. Tutor Hub can suspend or remove an account that breaches these terms, and will explain why unless doing so would compromise a safeguarding investigation.',
          ],
        },
      ]}
    />
  );
}
