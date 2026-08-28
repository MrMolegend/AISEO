import type { Metadata } from 'next';
import { PolicyPage } from '@/components/marketing/policy-page';

export const metadata: Metadata = {
  title: 'Safeguarding',
  description:
    'How Tutor Hub is designed to protect children and young people in online lessons, and how to raise a concern.',
};

export default function SafeguardingPage() {
  return (
    <PolicyPage
      title="Safeguarding"
      lead="Most learners on Tutor Hub are under 18. This is how the platform is designed to protect them, and what to do if something worries you."
      updated="August 2026"
      sections={[
        {
          heading: 'Who can teach here',
          paragraphs: [
            'Every tutor applies, and every application is read by a person. We check the identity document provided and evidence of the qualifications listed on the profile before a profile is published.',
            'Tutors working with under-18s are expected to hold a current enhanced DBS check. Verification of identity and qualification documents is a designed part of the platform and is not connected in this demonstration build — we say so rather than implying a check that has not happened.',
          ],
        },
        {
          heading: 'How lessons are designed to be safe',
          paragraphs: [
            'Keeping lessons and conversations inside Tutor Hub is not an administrative preference — it is the safeguard. It means there is a record, that support can act on a concern, and that nobody is negotiating privately outside the platform.',
          ],
          list: [
            'Lessons take place in the Tutor Hub room rather than on a personal video account.',
            'Messages between a tutor and a learner stay on the platform and are retained.',
            'A parent linked to a learner can always see who is teaching them, when, and what the tutor said afterwards.',
            'Asking to move contact off the platform is a breach of the terms and is treated as a warning sign.',
          ],
        },
        {
          heading: 'Parents and oversight',
          paragraphs: [
            'A parent account links to one or more learners. Parents see bookings, tutors, spending and the feedback a tutor writes after each lesson. An older learner can hold their own account and keep the content of their messages private, while the parent keeps oversight of who they are working with and what is being spent.',
            'This balance is deliberate: total surveillance discourages teenagers from asking for help, and no oversight leaves a parent unable to spot a problem.',
          ],
        },
        {
          heading: 'Raising a concern',
          paragraphs: [
            'Any lesson, message or profile can be reported from inside the product, which attaches the context automatically. Reports are triaged by the platform team, and anything involving the welfare of a child is escalated to the safeguarding contact immediately rather than joining a queue.',
            'If you believe someone is in immediate danger, contact the emergency services first, then tell us so we can act on the account.',
          ],
        },
        {
          heading: 'What happens after a report',
          paragraphs: [
            'We acknowledge the report, restrict the account involved where that is the safer course, and investigate. Where a report is substantiated the tutor is removed from the platform, and we cooperate with the relevant authorities where there is a duty to do so.',
            'We will keep the person who raised the concern informed as far as we are able to without compromising the investigation or anyone’s privacy.',
          ],
        },
      ]}
    />
  );
}
