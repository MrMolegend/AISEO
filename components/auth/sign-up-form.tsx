'use client';
import { EmailRequestForm } from './email-request-form';
import { requestSignUpLink } from '@/lib/auth/actions';

/** Creating an account: one field, then the check-email state. */
export function SignUpForm({ configured }: { configured: boolean }) {
  return (
    <EmailRequestForm
      configured={configured}
      send={requestSignUpLink}
      submitLabel="Send verification link"
      pendingLabel="Sending…"
      sentTitle="Check your email"
      sentBody={(email) => (
        <>
          We sent a verification link to <strong className="text-text">{email}</strong>.
          Open it to confirm the address and choose a password.
          <span className="mt-2 block">The link works once and lasts an hour.</span>
        </>
      )}
    />
  );
}
