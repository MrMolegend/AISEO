import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { getCurrentUser } from '@/lib/auth/server';
import { pageTitle } from '@/config/brand';

export const metadata: Metadata = {
  title: pageTitle('Choose a password'),
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Step two of creating an account.
 *
 * Requires a session, which only /auth/confirm can have produced. Anyone
 * arriving here without one followed a stale link or guessed the URL, and the
 * error page explains that better than an empty form would.
 */
export default async function SetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/error?reason=expired');

  return (
    <AuthShell
      title="Choose a password"
      subtitle={
        <>
          Your email is confirmed. Set a password and you will use it to sign in from now
          on.
          {user.email && (
            <span className="text-text-subtle mt-1 block text-sm">
              Signing in as {user.email}
            </span>
          )}
        </>
      }
    >
      <SetPasswordForm
        destination="/dashboard?welcome=1"
        submitLabel="Save and continue"
      />
    </AuthShell>
  );
}
