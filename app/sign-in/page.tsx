import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getCurrentUser, isSafeReturnPath } from '@/lib/auth/server';
import { pageTitle } from '@/config/brand';
import { authAvailable } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: pageTitle('Sign in'),
  robots: { index: false, follow: false },
};

/*
 * Never prerendered. The signed-in check reads cookies, and a build without
 * Supabase credentials would otherwise bake in the signed-out branch.
 */
export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = isSafeReturnPath(next) ? next : '/dashboard';

  // Someone already signed in has no business seeing this form.
  const user = await getCurrentUser();
  if (user) redirect(destination);

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back."
      footer={
        <>
          New here?{' '}
          <Link
            href="/sign-up"
            className="text-brand hover:text-brand-hover focus-visible:ring-brand rounded font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Create an account
          </Link>
        </>
      }
    >
      <SignInForm next={destination} configured={authAvailable()} />
    </AuthShell>
  );
}
