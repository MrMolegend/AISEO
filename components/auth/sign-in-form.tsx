'use client';
import { useId, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthMessage } from './auth-shell';
import { ResendCountdown } from './resend-countdown';
import {
  signInWithPassword,
  requestSignInLink,
  type AuthResult,
} from '@/lib/auth/actions';

/**
 * Signing in.
 *
 * Password first, because that is what a returning user has. The magic link is
 * one click away rather than the only option — the previous version offered
 * nothing else, which meant every sign-in depended on an email arriving, and
 * that is what turned one broken callback into a total outage.
 *
 * Every failure that reaches the user here has been through the mapper in
 * lib/auth/errors.ts, so a rate limit says "wait" and a wrong password says so.
 * The old generic sentence is gone.
 */

type Mode = 'password' | 'link';
type Phase = 'idle' | 'working' | 'sent';

export function SignInForm({ next, configured }: { next: string; configured: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [phase, setPhase] = useState<Phase>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failure, setFailure] = useState<AuthResult['failure']>(undefined);
  // Changing this remounts the countdown, which is how it restarts.
  const [sendId, setSendId] = useState(0);

  const emailId = useId();
  const passwordId = useId();
  const errorId = useId();

  if (!configured) {
    return (
      <AuthMessage tone="info" title="Sign-in is not available here">
        This deployment has no authentication configured, so accounts and reports are
        unavailable. Everything else on the site works.
      </AuthMessage>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (phase === 'working') return;

    setPhase('working');
    setFailure(undefined);

    const result =
      mode === 'password'
        ? await signInWithPassword(email, password)
        : await requestSignInLink(email, next);

    if (!result.ok) {
      setFailure(result.failure);
      setPhase('idle');
      return;
    }

    if (mode === 'link') {
      setSendId((n) => n + 1);
      setPhase('sent');
      return;
    }

    // A server-rendered header reads the session from cookies, so the page has
    // to be re-fetched rather than merely navigated to.
    router.replace(next);
    router.refresh();
  }

  async function resend() {
    setPhase('working');
    const result = await requestSignInLink(email, next);
    setFailure(result.ok ? undefined : result.failure);
    setSendId((n) => n + 1);
    setPhase('sent');
  }

  if (phase === 'sent') {
    return (
      <div className="space-y-5">
        <AuthMessage tone="success" title="Check your inbox">
          If <strong className="text-text">{email}</strong> has an account with us, a
          sign-in link is on its way. It works once and lasts an hour.
        </AuthMessage>

        {failure && (
          <AuthMessage tone="error" title={failure.title}>
            {failure.body}
          </AuthMessage>
        )}

        <ResendCountdown
          key={sendId}
          seconds={60}
          onResend={resend}
          pending={false}
          label="Send another link"
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

  const field =
    'border-rule-strong bg-ground-raised text-text placeholder:text-text-faint focus:border-cobalt focus-visible:ring-cobalt h-12 w-full rounded-[var(--radius-control)] border px-3.5 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60';

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
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
          className={field}
        />
      </div>

      {mode === 'password' && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor={passwordId} className="text-text block text-sm font-medium">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-cobalt hover:text-cobalt focus-visible:ring-cobalt rounded text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id={passwordId}
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            disabled={phase === 'working'}
            aria-describedby={failure ? errorId : undefined}
            aria-invalid={Boolean(failure)}
            className={field}
          />
        </div>
      )}

      {failure && (
        <AuthMessage id={errorId} tone="error" title={failure.title}>
          {failure.body}
        </AuthMessage>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={phase === 'working'}>
        {phase === 'working'
          ? mode === 'password'
            ? 'Signing in…'
            : 'Sending…'
          : mode === 'password'
            ? 'Sign in'
            : 'Email me a sign-in link'}
      </Button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'password' ? 'link' : 'password');
          setFailure(undefined);
        }}
        className="text-cobalt hover:text-cobalt focus-visible:ring-cobalt w-full rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        {mode === 'password'
          ? 'Email me a sign-in link instead'
          : 'Sign in with a password instead'}
      </button>
    </form>
  );
}
