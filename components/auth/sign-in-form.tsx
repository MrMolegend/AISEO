'use client';
import { useState } from 'react';
import { createAuthClient, authConfigured } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { BRAND } from '@/config/brand';

/**
 * Magic-link sign-in.
 *
 * No password, which removes a whole category of problems: nothing to store,
 * nothing to leak, nothing to reset. The trade is that a person has to leave
 * for their inbox, so the confirmation state has to be unambiguous about what
 * just happened and what to do next.
 *
 * The submitted state deliberately does not say whether the address has an
 * account. "Check your inbox" for both means the form cannot be used to
 * enumerate who has signed up.
 */
export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const configured = authConfigured();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state === 'sending') return;

    setState('sending');
    setMessage('');

    try {
      const supabase = createAuthClient();
      const callback = new URL('/auth/callback', window.location.origin);
      callback.searchParams.set('next', next);

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: callback.toString() },
      });

      if (error) throw error;
      setState('sent');
    } catch {
      setState('error');
      // Deliberately generic. The specific reason is usually a rate limit or a
      // provider hiccup, and neither is actionable for the person reading it.
      setMessage('We could not send that link. Please try again in a moment.');
    }
  }

  if (!configured) {
    return (
      <div
        role="status"
        className="border-line bg-surface-subtle rounded-[var(--radius-card)] border p-5"
      >
        <p className="text-ink text-sm font-medium">Sign-in is not configured</p>
        <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">
          This deployment has no Supabase credentials, so accounts are unavailable. Set
          NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable
          them.
        </p>
      </div>
    );
  }

  if (state === 'sent') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-brand-line bg-brand-subtle rounded-[var(--radius-card)] border p-5"
      >
        <p className="text-ink text-sm font-medium">Check your inbox</p>
        <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
          If <span className="font-medium">{email}</span> has an account with us, a
          sign-in link is on its way. It expires in an hour, and it only works once.
        </p>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="text-brand hover:text-brand-hover focus-visible:ring-brand mt-4 rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
        >
          Use a different address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="email" className="text-ink mb-2 block text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={state === 'error' ? 'sign-in-error' : 'sign-in-hint'}
          aria-invalid={state === 'error'}
          // 16px minimum, or iOS zooms the whole page on focus.
          className="border-line-strong bg-surface text-ink placeholder:text-ink-faint focus:border-brand focus-visible:ring-brand h-12 w-full rounded-[var(--radius-control)] border px-4 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none"
          placeholder="you@company.com"
        />
        <p id="sign-in-hint" className="text-ink-subtle mt-2 text-sm">
          We will email you a link. No password to remember.
        </p>
      </div>

      {state === 'error' && (
        <p
          id="sign-in-error"
          role="alert"
          className="text-sm text-[var(--color-severity-critical)]"
        >
          {message}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
      </Button>

      <p className="text-ink-faint text-xs leading-relaxed">
        Signing in creates an account if you do not have one. {BRAND.currency.name} are
        service credits attached to that account.
      </p>
    </form>
  );
}
