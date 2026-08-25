import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { pageTitle } from '@/config/brand';
import { authAvailable } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: pageTitle('Reset your password'),
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Tell us the address on your account and we will send a link to set a new password."
      footer={
        <>
          Remembered it?{' '}
          <Link
            href="/sign-in"
            className="text-brand hover:text-brand-hover focus-visible:ring-brand rounded font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Sign in
          </Link>
        </>
      }
    >
      <ForgotPasswordForm configured={authAvailable()} />
    </AuthShell>
  );
}
