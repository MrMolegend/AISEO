import Link from 'next/link';
import {
  CalendarCheck,
  FileCheck2,
  Flag,
  Lock,
  MessageSquareWarning,
  Search,
  ShieldCheck,
  Star,
  TrendingUp,
  Video,
} from 'lucide-react';
import { SubjectIcon } from '@/components/subjects/subject-icon';
import { Card } from '@/components/ui/card';
import type { Subject } from '@/lib/types';

/* ── Section scaffolding ──────────────────────────────────────────────────── */

export function Section({
  id,
  eyebrow,
  title,
  lead,
  action,
  children,
  className = '',
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  lead?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`container-page py-16 sm:py-20 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="text-brand text-sm font-semibold tracking-wide uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="mt-2 text-[1.75rem] tracking-[var(--tracking-tight)] sm:text-[2rem]">
            {title}
          </h2>
          {lead && <p className="text-ink-muted mt-3 leading-relaxed">{lead}</p>}
        </div>
        {action}
      </div>
      <div className="mt-9">{children}</div>
    </section>
  );
}

/* ── Subjects ─────────────────────────────────────────────────────────────── */

export function SubjectGrid({ subjects }: { subjects: Subject[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {subjects.map((subject) => (
        <li key={subject.id}>
          <Link
            href={`/tutors?subject=${subject.id}`}
            className="border-line bg-surface hover:border-brand-line hover:bg-brand-subtle/40 group flex h-full flex-col gap-3 rounded-[var(--radius-card)] border p-4 transition-colors duration-[var(--duration-fast)]"
          >
            <span className="bg-brand-subtle text-brand group-hover:bg-surface flex size-10 items-center justify-center rounded-[var(--radius-control)] transition-colors duration-[var(--duration-fast)]">
              <SubjectIcon name={subject.icon} className="size-5" />
            </span>
            <span className="text-[0.9375rem] font-semibold">{subject.name}</span>
            <span className="text-ink-subtle mt-auto text-xs">
              {subject.levels.join(' · ')}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ── How it works ─────────────────────────────────────────────────────────── */

const STEPS = [
  {
    icon: Search,
    title: 'Search and compare',
    body: 'Filter by subject, level, price and availability. Every profile shows qualifications, teaching approach and reviews from completed lessons.',
  },
  {
    icon: CalendarCheck,
    title: 'Choose a time',
    body: 'Pick a slot from the tutor’s own availability, set the lesson length and tell them what you want to cover.',
  },
  {
    icon: Video,
    title: 'Meet inside Tutor Hub',
    body: 'Join the lesson room from your dashboard. Objectives, shared notes and chat sit next to the video.',
  },
  {
    icon: TrendingUp,
    title: 'Track what changes',
    body: 'Feedback after each lesson, a record of what has been covered and a clear view of progress towards the goal.',
  },
];

/**
 * A numbered sequence rather than four identical cards: the rail on the left
 * makes it read as one process with an order to it.
 */
export function HowItWorksSteps() {
  return (
    <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative">
          <div
            className="border-line absolute top-5 left-5 hidden h-px w-full border-t border-dashed lg:block last:lg:hidden"
            aria-hidden
          />
          <div className="relative flex items-center gap-3">
            <span className="bg-brand text-on-brand relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-4 border-[var(--color-brand-subtle)] text-sm font-semibold">
              {index + 1}
            </span>
            <step.icon className="text-brand size-5 lg:hidden" aria-hidden />
          </div>
          <h3 className="mt-4 text-[1.0625rem] font-semibold">{step.title}</h3>
          <p className="text-ink-subtle mt-2 text-sm leading-relaxed">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/* ── Trust and safety ─────────────────────────────────────────────────────── */

const TRUST = [
  {
    icon: FileCheck2,
    title: 'Every tutor applies',
    body: 'Tutors submit their subjects, qualifications, experience and teaching approach. Nobody appears in search results until that application has been read.',
  },
  {
    icon: ShieldCheck,
    title: 'Identity and qualification checks',
    body: 'Tutor Hub is designed to verify identity documents and qualification certificates before a profile is published, and to record who approved it.',
  },
  {
    icon: Star,
    title: 'Reviews from real lessons',
    body: 'Only a student or parent who has completed a booked lesson can leave a review, so the ratings reflect teaching rather than intent.',
  },
  {
    icon: MessageSquareWarning,
    title: 'Messages stay on the platform',
    body: 'Keeping conversations inside Tutor Hub means there is a record if something goes wrong, and support can act on it.',
  },
  {
    icon: Flag,
    title: 'Reporting that reaches someone',
    body: 'Any lesson, message or profile can be reported. Reports are triaged by the platform team, with a safeguarding contact for urgent concerns.',
  },
  {
    icon: Lock,
    title: 'Payments handled by a processor',
    body: 'Card details will be handled by a regulated payment provider rather than stored by Tutor Hub. Payment is not connected in this build.',
  },
];

export function TrustGrid() {
  return (
    <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
      {TRUST.map((item) => (
        <li key={item.title} className="flex gap-3.5">
          <span className="bg-mint text-mint-ink flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
            <item.icon className="size-[18px]" aria-hidden />
          </span>
          <div>
            <h3 className="text-[0.9375rem] font-semibold">{item.title}</h3>
            <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">{item.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Closing panel ────────────────────────────────────────────────────────── */

export function ClosingPanel() {
  return (
    <section className="container-page pb-4">
      <Card className="surface-navy-gradient border-navy-line overflow-hidden">
        <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-[1.75rem] text-white sm:text-[2rem]">
              Ready when you are
            </h2>
            <p className="mt-3 leading-relaxed text-white/75">
              Start by browsing tutors for your subject and level — no account needed
              until you want to book. Tutors can apply at any time; applications are
              reviewed before a profile goes live.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/tutors"
              className="border-navy-line group flex flex-col justify-between rounded-[var(--radius-card)] border bg-white/5 p-5 transition-colors duration-[var(--duration-fast)] hover:bg-white/10"
            >
              <span>
                <span className="block font-semibold text-white">Find a tutor</span>
                <span className="mt-1.5 block text-sm text-white/70">
                  Compare rates, availability and reviews.
                </span>
              </span>
              <span className="text-mint-line mt-6 text-sm font-medium group-hover:underline">
                Browse the marketplace →
              </span>
            </Link>
            <Link
              href="/become-a-tutor"
              className="border-navy-line group flex flex-col justify-between rounded-[var(--radius-card)] border bg-white/5 p-5 transition-colors duration-[var(--duration-fast)] hover:bg-white/10"
            >
              <span>
                <span className="block font-semibold text-white">Teach with us</span>
                <span className="mt-1.5 block text-sm text-white/70">
                  Set your rate, hours and subjects.
                </span>
              </span>
              <span className="text-mint-line mt-6 text-sm font-medium group-hover:underline">
                Apply to become a tutor →
              </span>
            </Link>
          </div>
        </div>
      </Card>
    </section>
  );
}
