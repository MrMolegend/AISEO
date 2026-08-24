import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { getCurrentUser } from '@/lib/auth/server';
import { pageTitle } from '@/config/brand';

export const metadata: Metadata = {
  title: pageTitle('Set a new password'),
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * The end of password recovery.
 *
 * Same form as first-time setup — the session is equally real, having come from
 * a verified recovery link — but it lands on the dashboard with a confirmation
 * rather than a welcome.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/error?reason=expired');

  return (
    <AuthShell
      title="Set a new password"
      subtitle={
        user.email ? (
          <>
            Choose a new password for <strong className="text-ink">{user.email}</strong>.
          </>
        ) : (
          'Choose a new password for your account.'
        )
      }
    >
      <SetPasswordForm
        destination="/dashboard?password-reset=1"
        submitLabel="Save new password"
      />
    </AuthShell>
  );
}
