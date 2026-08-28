import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SignInForm } from '@/components/auth/sign-in-form';
import { DemoRolePicker } from '@/components/auth/demo-role-picker';
import { Skeleton } from '@/components/ui/states';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Tutor Hub to manage lessons, messages and bookings.',
};

export default function SignInPage() {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <h1 className="text-[1.75rem] tracking-[var(--tracking-tight)]">
            Sign in to Tutor Hub
          </h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            Your lessons, messages and saved tutors are waiting where you left them.
          </p>

          <div className="mt-7">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <SignInForm />
            </Suspense>
          </div>

          <p className="text-ink-subtle mt-5 text-sm">
            New to Tutor Hub?{' '}
            <Link href="/sign-up" className="text-brand font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        <div className="border-line bg-surface rounded-[var(--radius-panel)] border p-5 sm:p-6">
          <h2 className="text-base font-semibold">Skip the form</h2>
          <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">
            This build has no real accounts. Pick a role and you will land in that
            dashboard with example lessons, messages and bookings already in place.
          </p>
          <div className="mt-5">
            <Suspense fallback={<Skeleton className="h-72 w-full" />}>
              <DemoRolePicker />
            </Suspense>
          </div>
          <p className="text-ink-subtle mt-4 text-xs leading-relaxed">
            You can switch roles at any time from the account menu, and reset the demo
            data from the same place.
          </p>
        </div>
      </div>
    </div>
  );
}
