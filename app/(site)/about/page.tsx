import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, TrustGrid } from '@/components/home/sections';
import { Card, CardBody } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About',
  description:
    'What Tutor Hub is for, how tutors are reviewed, and how the platform is designed to keep online lessons safe.',
};

const PRINCIPLES = [
  {
    title: 'Say what a tutor is actually like',
    body: 'Profiles are long because the decision is real. Qualifications, how someone teaches, what they expect between lessons, and reviews from people who sat through the sessions.',
  },
  {
    title: 'Let people choose for themselves',
    body: 'No matching algorithm deciding who you should see, and no sales call before you can book. Filters, profiles and a price you can see.',
  },
  {
    title: 'Keep the workload off the tutor',
    body: 'Good tutors leave platforms that bury them in admin. Requests, reschedules, notes and payments belong in one system, not five.',
  },
  {
    title: 'Be honest about what is checked',
    body: 'We say exactly what verification covers rather than implying a guarantee. Where something is not yet in place, we say that too.',
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="surface-hero">
        <div className="container-page py-14 sm:py-16">
          <div className="max-w-2xl">
            <h1 className="text-[2rem] leading-[1.12] tracking-[var(--tracking-display)] sm:text-[2.5rem]">
              A tutoring marketplace built around the decision, not the sale
            </h1>
            <p className="text-ink-muted mt-5 text-[1.0625rem] leading-relaxed">
              Finding a tutor is a small, high-stakes decision made by someone who is
              usually already worried. Tutor Hub exists to make that decision
              straightforward: see who teaches your subject at your level, read enough to
              judge them properly, and book a time without a phone call.
            </p>
          </div>
        </div>
      </section>

      <Section eyebrow="What we are for" title="Four things we try to get right">
        <div className="grid gap-5 sm:grid-cols-2">
          {PRINCIPLES.map((principle) => (
            <Card key={principle.title}>
              <CardBody>
                <h2 className="text-[1.0625rem] font-semibold">{principle.title}</h2>
                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  {principle.body}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <div className="bg-surface border-line border-y">
        <Section
          id="safety"
          eyebrow="Trust and safety"
          title="How Tutor Hub is designed to keep lessons safe"
          lead="These are the safeguards the platform is built around. Where a check is not live in this build, we say so rather than implying otherwise."
        >
          <TrustGrid />

          <Card className="mt-10">
            <CardBody className="sm:p-6">
              <h3 className="text-base font-semibold">What verification means here</h3>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                A verified badge means the Tutor Hub team has read the tutor’s
                application, checked the identity document they provided and seen evidence
                of the qualifications listed on their profile. It is not a statutory
                certification, and it is not a guarantee of teaching quality — the reviews
                and the profile are there for that.
              </p>
              <p className="text-ink-muted mt-3 text-sm leading-relaxed">
                Tutors working with under-18s are expected to hold a current enhanced DBS
                check. Where a tutor has provided one, that will be shown on their profile
                once the verification workflow is connected.
              </p>
              <p className="text-ink-subtle mt-3 text-sm">
                Read the{' '}
                <Link href="/safeguarding" className="text-brand hover:underline">
                  safeguarding approach
                </Link>{' '}
                for how concerns are handled.
              </p>
            </CardBody>
          </Card>
        </Section>
      </div>

      <Section eyebrow="This build" title="What you are looking at">
        <div className="max-w-3xl space-y-4">
          <p className="text-ink-muted leading-relaxed">
            This is a frontend demonstration of Tutor Hub. Everything you can click works,
            but nothing leaves your browser: bookings, messages, saved tutors and tutor
            applications are stored locally on this device, and no account is created on a
            server.
          </p>
          <p className="text-ink-muted leading-relaxed">
            Payments, video calling, email and identity verification are the four things
            that genuinely need a backend, and none of them is connected. Where you would
            expect one, the interface says so plainly rather than pretending.
          </p>
          <p className="text-ink-muted leading-relaxed">
            You can sign in as a student, a parent, a tutor or an administrator from the
            sign-in screen, and switch between them at any time from the account menu.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/sign-in" size="lg">
            Try a demo account
          </ButtonLink>
          <ButtonLink href="/contact" variant="secondary" size="lg">
            Contact us
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
