import type { Metadata } from 'next';
import {
  BadgeCheck,
  CalendarCheck,
  ClipboardList,
  MessageSquare,
  PoundSterling,
  Users,
} from 'lucide-react';
import { ApplicationForm } from '@/components/apply/application-form';
import { Section } from '@/components/home/sections';
import { Card, CardBody } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { getTutors } from '@/lib/queries';
import { formatPence } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Become a tutor',
  description:
    'Apply to teach on Tutor Hub. Set your own rate and hours, take bookings without the back-and-forth, and teach in a room built for lessons.',
};

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Apply',
    body: 'Tell us your subjects, levels, experience and how you teach. It takes about fifteen minutes and saves as you go.',
  },
  {
    icon: BadgeCheck,
    title: 'Get reviewed',
    body: 'A person reads every application. We check your qualifications and identity before anything is published, and ask questions rather than declining outright.',
  },
  {
    icon: CalendarCheck,
    title: 'Set your hours and rate',
    body: 'You decide when you teach, how long lessons are and what you charge. Block out dates whenever you need to.',
  },
  {
    icon: PoundSterling,
    title: 'Teach and get paid',
    body: 'Lessons happen in the Tutor Hub room. Payment is collected up front by a payment provider and released to you after the lesson.',
  },
];

const REASONS = [
  {
    icon: Users,
    title: 'Students who are already looking',
    body: 'People arrive on Tutor Hub having decided they want a tutor. Your profile has to answer their questions, not persuade them to start.',
  },
  {
    icon: MessageSquare,
    title: 'No admin sprawl',
    body: 'Requests, reschedules, messages and lesson notes live in one place instead of across three inboxes and a spreadsheet.',
  },
  {
    icon: BadgeCheck,
    title: 'Verification worth having',
    body: 'Because every tutor is reviewed, a verified badge means something to the parent reading your profile.',
  },
];

export default function BecomeATutorPage() {
  const rates = getTutors().map((tutor) => tutor.hourlyRate);
  const lowest = Math.min(...rates);
  const highest = Math.max(...rates);

  return (
    <>
      <section className="surface-hero">
        <div className="container-page grid gap-10 pt-12 pb-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16 lg:pt-16">
          <div>
            <p className="text-brand-ink bg-surface border-brand-line inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium">
              <BadgeCheck className="size-4" aria-hidden />
              Applications are read by a person
            </p>
            <h1 className="mt-5 text-[2rem] leading-[1.1] tracking-[var(--tracking-display)] sm:text-[2.5rem]">
              Teach the students you are best for, on your own terms
            </h1>
            <p className="text-ink-muted mt-5 max-w-xl leading-relaxed">
              Tutor Hub is for experienced tutors and teachers who want the bookings
              without the administration. You set your rate and your hours; we handle
              discovery, scheduling, messaging and the lesson room.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <ButtonLink href="#application" size="lg">
                Start your application
              </ButtonLink>
              <ButtonLink href="/tutors" variant="secondary" size="lg">
                See who already teaches here
              </ButtonLink>
            </div>
            <p className="text-ink-subtle mt-4 text-sm">
              Tutors on Tutor Hub currently charge between {formatPence(lowest)} and{' '}
              {formatPence(highest)} an hour, and set that figure themselves.
            </p>
          </div>

          <Card className="p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-semibold">Who Tutor Hub is for</h2>
            <ul className="text-ink-muted mt-4 space-y-3 text-sm leading-relaxed">
              <li>
                <span className="text-ink font-medium">Classroom teachers</span> tutoring
                in the evenings, who know their exam board inside out.
              </li>
              <li>
                <span className="text-ink font-medium">Full-time tutors</span> who want a
                steadier stream of enquiries than word of mouth provides.
              </li>
              <li>
                <span className="text-ink font-medium">
                  Specialists and postgraduates
                </span>{' '}
                supporting university modules, dissertations and admissions tests.
              </li>
              <li>
                <span className="text-ink font-medium">Professionals</span> teaching adult
                learners — statistics for work, business, or a return to study.
              </li>
            </ul>
            <p className="text-ink-subtle border-line mt-5 border-t pt-4 text-sm leading-relaxed">
              We do not take tutors without teaching or tutoring experience. If you are
              starting out, come back after a term of classroom or volunteer teaching.
            </p>
          </Card>
        </div>
      </section>

      <Section
        eyebrow="How it works"
        title="From application to your first lesson"
        lead="Four stages, and you are in control of the last two."
      >
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <div className="flex items-center gap-3">
                <span className="bg-brand text-on-brand flex size-9 items-center justify-center rounded-full border-4 border-[var(--color-brand-subtle)] text-sm font-semibold">
                  {index + 1}
                </span>
                <step.icon className="text-brand size-5" aria-hidden />
              </div>
              <h3 className="mt-4 text-[1.0625rem] font-semibold">{step.title}</h3>
              <p className="text-ink-subtle mt-2 text-sm leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <div className="bg-surface border-line border-y">
        <Section
          eyebrow="Why here"
          title="What you get that a marketplace listing does not give you"
        >
          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-3">
            {REASONS.map((reason) => (
              <li key={reason.title} className="flex gap-3.5">
                <span className="bg-mint text-mint-ink flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                  <reason.icon className="size-[18px]" aria-hidden />
                </span>
                <div>
                  <h3 className="text-[0.9375rem] font-semibold">{reason.title}</h3>
                  <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">
                    {reason.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Card className="mt-10">
            <CardBody className="grid gap-6 sm:grid-cols-2 sm:p-6">
              <div>
                <h3 className="text-base font-semibold">How payouts will work</h3>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  Students pay when they book. The money is held until the lesson has
                  taken place and then released to you, with the platform fee already
                  deducted. Payouts will run weekly through a regulated payment provider —
                  Tutor Hub will never hold your bank details itself.
                </p>
              </div>
              <div>
                <h3 className="text-base font-semibold">What Tutor Hub charges</h3>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  The service fee is added to the student’s total rather than taken out of
                  your rate, so the figure you set is the figure you are quoting. It
                  covers messaging, the lesson room, support and payment processing.
                </p>
                <p className="text-ink-subtle mt-2 text-sm">
                  Payments are not connected in this demonstration build.
                </p>
              </div>
            </CardBody>
          </Card>
        </Section>
      </div>

      <section id="application" className="container-page py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 max-w-2xl">
            <p className="text-brand text-sm font-semibold tracking-wide uppercase">
              Application
            </p>
            <h2 className="mt-2 text-[1.75rem] tracking-[var(--tracking-tight)]">
              Tell us what you teach
            </h2>
            <p className="text-ink-muted mt-3 leading-relaxed">
              Eight short steps. Your answers are saved in this browser as you go, so you
              can stop and come back.
            </p>
          </div>
          <ApplicationForm />
        </div>
      </section>
    </>
  );
}
