import type { Metadata } from 'next';
import { PolicyPage } from '@/components/marketing/policy-page';

export const metadata: Metadata = {
  title: 'Privacy',
  description:
    'What information Tutor Hub collects, why it is needed, and how long it is kept.',
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      title="Privacy"
      lead="What Tutor Hub collects, why each piece is needed, and what happens to it afterwards."
      updated="August 2026"
      sections={[
        {
          heading: 'What this build stores',
          paragraphs: [
            'This demonstration stores everything in your own browser. Bookings you create, messages you send, tutors you save, applications you submit and your theme preference are written to localStorage on this device and never transmitted anywhere.',
            'Clearing your browser data, or using the reset option in the account menu, removes all of it. There is no account on a server to delete.',
          ],
        },
        {
          heading: 'What the live product would collect',
          paragraphs: [
            'A working Tutor Hub needs a small amount of personal data to function at all. The principle is that each item has to earn its place by making the service work.',
          ],
          list: [
            'Account details: name, email address and the role you signed up as.',
            'Learner links: for parent accounts, the learners connected to the account and their year group and level.',
            'Tutor applications: subjects, qualifications, experience, and the identity and certificate documents used for verification.',
            'Bookings: which lesson, with whom, when, and what was paid.',
            'Messages: the conversations between students, parents and tutors on the platform.',
            'Technical data: the minimum needed to keep you signed in and to keep the service secure.',
          ],
        },
        {
          heading: 'What we would not do',
          paragraphs: [
            'Tutor Hub would not sell personal data, would not share a learner’s messages with anyone other than the people in the conversation, and would not use lesson content to train models.',
            'Card details would be handled entirely by a regulated payment provider. Tutor Hub would never see or store a card number.',
          ],
        },
        {
          heading: 'Children and young people',
          paragraphs: [
            'Many learners on Tutor Hub are under 18. Accounts for under-13s would be held by a parent or carer, and older learners would be able to hold their own account with a parent retaining oversight of bookings and spending but not of private messages.',
            'Verification documents for tutors would be visible only to the review team and retained only as long as the tutor holds an active profile.',
          ],
        },
        {
          heading: 'How long things are kept',
          paragraphs: [
            'Bookings and their financial records would be kept for as long as accounting rules require. Messages would be kept while the account is open and for a short period afterwards, because they are often the evidence in a dispute. Verification documents would be deleted once a profile is closed.',
          ],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            'Under UK data protection law you can ask for a copy of your data, ask for it to be corrected, ask for it to be deleted, and object to certain uses. In the live product those requests would go to the support address, and we would respond within one month.',
          ],
        },
      ]}
    />
  );
}
