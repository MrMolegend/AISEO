'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { GraduationCap, ShieldCheck, UserRound, Users } from 'lucide-react';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { DASHBOARD_HOME } from '@/lib/nav';
import type { Role } from '@/lib/types';

const OPTIONS: {
  role: Role;
  label: string;
  name: string;
  detail: string;
  icon: typeof UserRound;
}[] = [
  {
    role: 'student',
    label: 'Continue as student',
    name: 'Maya Bennett',
    detail: 'A-Level Maths and Physics, two tutors, a lesson today',
    icon: UserRound,
  },
  {
    role: 'parent',
    label: 'Continue as parent',
    name: 'Sarah Kaur',
    detail: 'Two linked learners in Years 11 and 13',
    icon: Users,
  },
  {
    role: 'tutor',
    label: 'Continue as tutor',
    name: 'Priya Raghavan',
    detail: 'Chemistry and Biology, 158 reviews, a new request',
    icon: GraduationCap,
  },
  {
    role: 'admin',
    label: 'Continue as administrator',
    name: 'Dan Foster',
    detail: 'Application queue, tutor management and reports',
    icon: ShieldCheck,
  },
];

/**
 * There are no credentials to remember: choosing a role selects one of the demo
 * accounts in `lib/data/people.ts` and stores the choice locally. Supabase Auth
 * replaces this component and nothing else.
 */
export function DemoRolePicker() {
  const { signInAsRole } = useDemo();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  return (
    <ul className="space-y-2.5">
      {OPTIONS.map((option) => (
        <li key={option.role}>
          <button
            type="button"
            onClick={() => {
              const account = signInAsRole(option.role);
              if (!account) return;
              toast({
                title: `Signed in as ${account.firstName}`,
                description: `You are viewing Tutor Hub as a ${option.role}.`,
              });
              router.push(next ?? DASHBOARD_HOME[option.role]);
            }}
            className="border-line bg-surface hover:border-brand hover:bg-brand-subtle/40 flex w-full items-center gap-3.5 rounded-[var(--radius-card)] border p-4 text-left transition-colors duration-[var(--duration-fast)]"
          >
            <span className="bg-brand-subtle text-brand flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)]">
              <option.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="text-ink block text-[0.9375rem] font-semibold">
                {option.label}
              </span>
              <span className="text-ink-subtle block text-sm">
                {option.name} — {option.detail}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
