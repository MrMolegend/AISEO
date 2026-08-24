import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SignInForm } from '@/components/auth/sign-in-form';
import { Logo } from '@/components/ui/logo';
import { getCurrentUser, isSafeReturnPath } from '@/lib/auth/server';
import { pageTitle, BRAND } from '@/config/brand';

export const metadata: Metadata = {
  title: pageTitle('Sign in'),
  robots: { index: false, follow: false },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const user = await getCurrentUser();

  // Already signed in: go where they were heading rather than showing a form
  // that would do nothing.
  const destination = isSafeReturnPath(next) ? next : '/dashboard';
  if (user) redirect(destination);

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16"
    >
      <Link
        href="/"
        className="focus-visible:ring-brand mb-10 self-start rounded focus-visible:ring-2 focus-visible:outline-none"
      >
        <Logo />
      </Link>

      <h1 className="text-ink text-[30px] leading-tight font-semibold tracking-[var(--tracking-display)]">
        Sign in
      </h1>
      <p className="text-ink-muted mt-2 mb-8 leading-relaxed">
        {BRAND.name} keeps your reports and your {BRAND.currency.plural} on your account.
      </p>

      <SignInForm next={destination} />
    </main>
  );
}
