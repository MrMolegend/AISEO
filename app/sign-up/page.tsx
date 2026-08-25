import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { getCurrentUser } from '@/lib/auth/server';
import { BRAND, pageTitle } from '@/config/brand';
import { authAvailable } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: pageTitle('Create an account'),
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function SignUpPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <AuthShell
      title="Create an account"
      subtitle={
        <>
          We will email you a link to confirm the address. You will choose a password
          straight afterwards.
        </>
      }
      footer={
        <>
          Already have one?{' '}
          <Link
            href="/sign-in"
            className="text-brand hover:text-brand-hover focus-visible:ring-brand rounded font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Sign in
          </Link>
          <span className="text-ink-faint mt-4 block text-xs leading-relaxed">
            {BRAND.currency.disclaimer}
          </span>
        </>
      }
    >
      <SignUpForm configured={authAvailable()} />
    </AuthShell>
  );
}
