'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createAuthClient } from '@/lib/auth/client';

export function SignOutButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function signOut() {
    setBusy(true);
    try {
      await createAuthClient().auth.signOut();
    } catch {
      // Already signed out, or auth is unconfigured. The redirect below lands on
      // a page that renders correctly either way.
    }
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-11 items-center rounded-[var(--radius-control)] border px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
