'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AuthMessage } from './auth-shell';
import { ResendCountdown } from './resend-countdown';
import { type AuthResult } from '@/lib/auth/actions';

/**
 * Email in, link out — the shape shared by creating an account and recovering a
 * password.
 *
 * Both do the same three things: take an address, ask Supabase to send
 * something, then show a "check your email" state that must not let the user
 * hammer the send button. Writing that twice is how the two screens drift
 * apart, and one of them ends up without a cooldown.
 *
 * The sent state deliberately says "if that address has an account" rather than
 * confirming one exists. A form that answers that question is an account
 * enumeration oracle.
 */

export function EmailRequestForm({
  configured,
  send,
  submitLabel,
  pendingLabel,
  sentTitle,
  sentBody,
}: {
  /**
   * Resolved on the server, not read from NEXT_PUBLIC_ here.
   *
   * The server knows things the browser bundle cannot: whether a real Supabase
   * project is configured *and* whether a stand-in driver is serving. A client
   * reading the public env alone would render "not available" during the
   * end-to-end suite, hiding the very form under test.
   */
  configured: boolean;
  send: (email: string) => Promise<AuthResult>;
  submitLabel: string;
  pendingLabel: string;
  sentTitle: string;
  /** Rendered with the address the user actually typed. */
  sentBody: (email: string) => React.ReactNode;
}) {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<'idle' | 'working' | 'sent'>('idle');
  const [failure, setFailure] = useState<AuthResult['failure']>(undefined);
  const [sendId, setSendId] = useState(0);

  const emailId = useId();
  const errorId = useId();

  if (!configured) {
    return (
      <AuthMessage tone="info" title="Accounts are not available here">
        This deployment has no authentication configured.
      </AuthMessage>
    );
  }

  async function dispatch() {
    setPhase('working');
    setFailure(undefined);

    const result = await send(email);

    if (!result.ok) {
      setFailure(result.failure);
      // A rate limit still means an email went out earlier, so the check-email
      // screen with its countdown is the honest place to land — not the form
      // with a red box inviting another attempt.
      setPhase(result.failure?.cooldownSeconds ? 'sent' : 'idle');
      setSendId((n) => n + 1);
      return;
    }

    setSendId((n) => n + 1);
    setPhase('sent');
  }

  if (phase === 'sent') {
    return (
      <div className="space-y-5">
        <AuthMessage tone="success" title={sentTitle}>
          {sentBody(email)}
        </AuthMessage>

        {failure && (
          <AuthMessage tone="error" title={failure.title}>
            {failure.body}
          </AuthMessage>
        )}

        <ResendCountdown
          key={sendId}
          seconds={failure?.cooldownSeconds || 60}
          onResend={dispatch}
        />

        <button
          type="button"
          onClick={() => {
            setPhase('idle');
            setFailure(undefined);
          }}
          className="text-cobalt hover:text-cobalt focus-visible:ring-cobalt rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (phase !== 'working') void dispatch();
      }}
      noValidate
      className="space-y-5"
    >
      <div>
        <label htmlFor={emailId} className="text-text mb-1.5 block text-sm font-medium">
          Email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          placeholder="you@example.com"
          disabled={phase === 'working'}
          aria-describedby={failure ? errorId : undefined}
          aria-invalid={Boolean(failure)}
          className="border-rule-strong bg-ground-raised text-text placeholder:text-text-faint focus:border-cobalt focus-visible:ring-cobalt h-12 w-full rounded-[var(--radius-control)] border px-3.5 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        />
      </div>

      {failure && (
        <AuthMessage id={errorId} tone="error" title={failure.title}>
          {failure.body}
        </AuthMessage>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={phase === 'working'}>
        {phase === 'working' ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
