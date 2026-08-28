import type { Metadata } from 'next';
import {
  CalendarCheck,
  CreditCard,
  MessageSquare,
  Search,
  Star,
  TrendingUp,
  Video,
} from 'lucide-react';
import { Section, HowItWorksSteps } from '@/components/home/sections';
import { Card, CardBody } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'How Tutor Hub works for students, parents and tutors — finding a tutor, booking a lesson, meeting online and tracking progress.',
};

const FAQS = [
  {
    q: 'How much do lessons cost?',
    a: 'Tutors set their own hourly rate, currently between about £22 and £55. Tutor Hub adds a service fee on top of that at checkout, shown separately so the tutor’s rate stays clear.',
  },
  {
    q: 'Do I have to commit to a block of lessons?',
    a: 'No. You book one lesson at a time. Most people book weekly once they have found someone who suits them, but nothing obliges you to.',
  },
  {
    q: 'What if the tutor is not right?',
    a: 'Book a different one. Nothing is locked in, and several tutors offer a short introductory call or a reduced first lesson so you can find out before committing.',
  },
  {
    q: 'Can I cancel or move a lesson?',
    a: 'Yes. Each tutor sets their own notice period — usually 24 hours — and you can request a reschedule from your lessons list at any time.',
  },
  {
    q: 'What do I need for the lesson itself?',
    a: 'A browser, a microphone and somewhere quiet. A webcam helps but is not required, and a tablet or graphics tablet is useful for maths and science.',
  },
  {
    q: 'How do parents fit in?',
    a: 'A parent account links to one or more learners. Parents can book, see upcoming lessons, read tutor feedback and track spending, while an older learner keeps their own messages private.',
  },
];

const FOR_TUTORS = [
  {
    icon: Search,
    title: 'Be found by the right students',
    body: 'Students filter by subject, level, price and availability. A specific profile beats a broad one.',
  },
  {
    icon: CalendarCheck,
    title: 'Bookings come to you',
    body: 'Students book from your real availability. You accept, propose another time, or block the date out.',
  },
  {
    icon: CreditCard,
    title: 'Get paid after the lesson',
    body: 'Payment is taken when the student books and released to you once the lesson has happened.',
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="surface-hero">
        <div className="container-page py-14 sm:py-16">
          <div className="max-w-2xl">
            <h1 className="text-[2rem] leading-[1.12] tracking-[var(--tracking-display)] sm:text-[2.5rem]">
              How Tutor Hub works
            </h1>
            <p className="text-ink-muted mt-5 text-[1.0625rem] leading-relaxed">
              No agency in the middle and no phone call to arrange a trial. You compare
              tutors yourself, book a time that works, and everything after that — the
              lesson, the messages, the notes — happens in one place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ButtonLink href="/tutors" size="lg">
                Find a tutor
              </ButtonLink>
              <ButtonLink href="/become-a-tutor" variant="secondary" size="lg">
                Apply to teach
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <Section
        eyebrow="For students and parents"
        title="Four steps from searching to seeing a difference"
      >
        <HowItWorksSteps />
      </Section>

      <div className="bg-surface border-line border-y">
        <Section eyebrow="In more detail" title="What each stage actually involves">
          <div className="grid gap-5 lg:grid-cols-2">
            <DetailCard
              icon={<Search className="size-5" aria-hidden />}
              title="Comparing tutors"
              body="Every profile shows qualifications, the levels and boards they teach, their hourly rate, how quickly they usually reply and reviews left after completed lessons. Filter by price, rating and how soon someone is free, then shortlist two or three before deciding."
            />
            <DetailCard
              icon={<CalendarCheck className="size-5" aria-hidden />}
              title="Booking a lesson"
              body="Pick a slot from the tutor’s own availability, choose 45, 60 or 90 minutes, and add a note about what you are stuck on. You will see the lesson price, the service fee and the total before confirming."
            />
            <DetailCard
              icon={<Video className="size-5" aria-hidden />}
              title="The lesson itself"
              body="The room opens ten minutes before the start. Alongside the video there are the objectives you agreed, shared notes that stay with the lesson afterwards, and a chat panel for links and questions."
            />
            <DetailCard
              icon={<MessageSquare className="size-5" aria-hidden />}
              title="Between lessons"
              body="Message your tutor a photo of the question you could not finish. Keeping it on Tutor Hub means there is a record, and it keeps the conversation next to the booking it belongs to."
            />
            <DetailCard
              icon={<TrendingUp className="size-5" aria-hidden />}
              title="Seeing progress"
              body="Tutors add a short note after each lesson — what improved and what to work on. Those notes, plus lesson counts and the goal you agreed, make up the progress view. It is deliberately not a grading system."
            />
            <DetailCard
              icon={<Star className="size-5" aria-hidden />}
              title="Reviews"
              body="Only a student or parent who has completed a booked lesson can leave a review, which is why the ratings on Tutor Hub are not all five stars."
            />
          </div>
        </Section>
      </div>

      <Section
        id="tutors"
        eyebrow="For tutors"
        title="What it looks like from the other side"
      >
        <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-3">
          {FOR_TUTORS.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span className="bg-brand-subtle text-brand flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                <item.icon className="size-[18px]" aria-hidden />
              </span>
              <div>
                <h3 className="text-[0.9375rem] font-semibold">{item.title}</h3>
                <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">
                  {item.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <ButtonLink href="/become-a-tutor" className="mt-8">
          Read more about teaching on Tutor Hub
        </ButtonLink>
      </Section>

      <div className="bg-surface border-line border-y">
        <Section eyebrow="Questions" title="Things people ask before they book">
          <div className="grid gap-x-10 gap-y-7 lg:grid-cols-2">
            {FAQS.map((faq) => (
              <div key={faq.q}>
                <h3 className="text-[1.0625rem] font-semibold">{faq.q}</h3>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
          <p className="text-ink-subtle mt-8 text-sm">
            Something else on your mind?{' '}
            <a href="/contact" className="text-brand hover:underline">
              Get in touch
            </a>
            .
          </p>
        </Section>
      </div>
    </>
  );
}

function DetailCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card>
      <CardBody className="flex gap-4">
        <span className="bg-brand-subtle text-brand flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
          {icon}
        </span>
        <div>
          <h3 className="text-[1.0625rem] font-semibold">{title}</h3>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">{body}</p>
        </div>
      </CardBody>
    </Card>
  );
}
