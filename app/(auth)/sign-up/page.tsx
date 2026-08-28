import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { DemoRolePicker } from '@/components/auth/demo-role-picker';
import { Skeleton } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Create an account',
  description:
    'Create a Tutor Hub account as a student, a parent or a tutor applying to teach.',
};

const BENEFITS = [
  'Save tutors and compare them side by side',
  'Book lessons from a tutor’s real availability',
  'Keep messages, notes and lesson history in one place',
  'Parents can link learners and follow progress',
];

export default function SignUpPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14">
        <div>
          <h1 className="text-[1.75rem] tracking-[var(--tracking-tight)]">
            Create your Tutor Hub account
          </h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            It takes a minute, and you can browse tutors before you commit to anything.
          </p>

          <div className="mt-7">
            <SignUpForm />
          </div>

          <p className="text-ink-subtle mt-5 text-sm">
            Already have an account?{' '}
            <Link href="/sign-in" className="text-brand font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="space-y-6">
          <div className="border-line bg-surface rounded-[var(--radius-panel)] border p-5">
            <h2 className="text-base font-semibold">What an account gives you</h2>
            <ul className="mt-3.5 space-y-2.5">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="text-ink-muted flex gap-2.5 text-sm">
                  <CheckCircle2
                    className="text-success mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="border-line bg-surface rounded-[var(--radius-panel)] border p-5">
            <h2 className="text-base font-semibold">Just looking around?</h2>
            <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">
              Jump straight into a demo account with example data.
            </p>
            <div className="mt-4">
              <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                <DemoRolePicker />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
