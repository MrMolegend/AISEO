'use client';
import { EmailRequestForm } from './email-request-form';
import { requestPasswordReset } from '@/lib/auth/actions';

/** Password recovery: the same shape as sign-up, different copy and endpoint. */
export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  return (
    <EmailRequestForm
      configured={configured}
      send={requestPasswordReset}
      submitLabel="Send reset link"
      pendingLabel="Sending…"
      sentTitle="Check your email"
      sentBody={(email) => (
        <>
          If <strong className="text-ink">{email}</strong> has an account with us, a link
          to set a new password is on its way.
          <span className="mt-2 block">The link works once and lasts an hour.</span>
        </>
      )}
    />
  );
}
