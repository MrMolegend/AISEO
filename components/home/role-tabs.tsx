'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  CreditCard,
  LineChart,
  MessageSquare,
  Search,
  ShieldCheck,
  Sliders,
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { ButtonLink } from '@/components/ui/button';

const CONTENT = {
  students: {
    heading: 'Everything a student needs in one place',
    body: 'Find a tutor who teaches your board, book around school, and keep every lesson, message and note together.',
    cta: { href: '/tutors', label: 'Browse tutors' },
    points: [
      {
        icon: Search,
        title: 'Compare on what matters',
        body: 'Filter by subject, level, price and how soon someone is free — then read the reviews from people who actually had the lessons.',
      },
      {
        icon: CalendarCheck,
        title: 'Book a time that fits',
        body: 'Pick from the tutor’s real availability and add a note about what you are stuck on before the lesson starts.',
      },
      {
        icon: MessageSquare,
        title: 'Ask between lessons',
        body: 'Message your tutor a photo of the question you could not finish. Everything stays in one thread.',
      },
      {
        icon: Video,
        title: 'Learn inside Tutor Hub',
        body: 'Join from the dashboard. Objectives, shared notes and chat sit alongside the video.',
      },
    ],
  },
  parents: {
    heading: 'Oversight without hovering',
    body: 'Link your children to your account, see what has been booked and read what the tutor said afterwards.',
    cta: { href: '/sign-up', label: 'Set up a parent account' },
    points: [
      {
        icon: Users,
        title: 'One account, every learner',
        body: 'Switch between children to see their lessons, tutors and progress separately.',
      },
      {
        icon: CalendarCheck,
        title: 'Know what is booked',
        body: 'Upcoming lessons, who is teaching them and what they cost, on one screen.',
      },
      {
        icon: LineChart,
        title: 'See whether it is working',
        body: 'Tutor feedback after each lesson, plus lesson counts and the goal you agreed.',
      },
      {
        icon: CreditCard,
        title: 'Understand the spend',
        body: 'A running total by learner and by month, so tuition is a budget line rather than a surprise.',
      },
    ],
  },
  tutors: {
    heading: 'A practical place to run your tutoring',
    body: 'Set your own rate and hours, take bookings without the back-and-forth, and keep your teaching in one system.',
    cta: { href: '/become-a-tutor', label: 'Apply to teach' },
    points: [
      {
        icon: UserCheck,
        title: 'A profile that earns enquiries',
        body: 'Qualifications, approach and reviews in a format students and parents can compare quickly.',
      },
      {
        icon: Sliders,
        title: 'Availability you control',
        body: 'Weekly hours, one-off blocked dates, and lesson lengths that suit how you teach.',
      },
      {
        icon: CalendarCheck,
        title: 'Bookings without the emails',
        body: 'Requests, confirmations and reschedules arrive in one queue instead of five inboxes.',
      },
      {
        icon: ShieldCheck,
        title: 'Verification that means something',
        body: 'Reviewed applications and checked documents, so a verified badge is worth having.',
      },
    ],
  },
} as const;

type TabId = keyof typeof CONTENT;

const TABS = [
  { id: 'students', label: 'Students' },
  { id: 'parents', label: 'Parents' },
  { id: 'tutors', label: 'Tutors' },
];

export function RoleTabs() {
  const [tab, setTab] = useState<TabId>('students');

  return (
    <div>
      <Tabs
        items={TABS}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        className="justify-start"
      />

      <div className="pt-8">
        {(Object.keys(CONTENT) as TabId[]).map((id) => {
          const panel = CONTENT[id];
          return (
            <TabPanel key={id} id={id} active={tab === id}>
              <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:gap-14">
                <div>
                  <h3 className="text-2xl tracking-[var(--tracking-tight)]">
                    {panel.heading}
                  </h3>
                  <p className="text-ink-muted mt-3 leading-relaxed">{panel.body}</p>
                  <ButtonLink href={panel.cta.href} variant="secondary" className="mt-6">
                    {panel.cta.label}
                  </ButtonLink>
                </div>

                <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {panel.points.map((point) => (
                    <li key={point.title} className="flex gap-3.5">
                      <span className="bg-brand-subtle text-brand flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
                        <point.icon className="size-[18px]" aria-hidden />
                      </span>
                      <div>
                        <h4 className="text-[0.9375rem] font-semibold">{point.title}</h4>
                        <p className="text-ink-subtle mt-1 text-sm leading-relaxed">
                          {point.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </TabPanel>
          );
        })}
      </div>

      <p className="text-ink-subtle mt-10 text-sm">
        Not sure which account you need?{' '}
        <Link href="/how-it-works" className="text-brand hover:underline">
          Read how Tutor Hub works
        </Link>
        .
      </p>
    </div>
  );
}
