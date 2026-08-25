'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AuthMessage } from './auth-shell';
import { PasswordFields, passwordProblem, type PasswordState } from './password-fields';
import { setPassword } from '@/lib/auth/actions';
import { type AuthResult } from '@/lib/auth/actions';

/**
 * Choosing a password, on a session that already exists.
 *
 * Reachable only after /auth/confirm has verified an email link, which is what
 * makes it safe not to ask for the current password: possession of the mailbox
 * was proved on the request that got the user here.
 *
 * The plaintext goes to Supabase and nowhere else. This application has no
 * password column, stores no hash, and never logs the field — the whole point
 * of delegating auth is not to be in that business.
 */

export function SetPasswordForm({
  destination,
  submitLabel,
}: {
  /** Where to land afterwards. Already validated by the page. */
  destination: string;
  submitLabel: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState<PasswordState>({ password: '', confirm: '' });
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<AuthResult['failure']>(undefined);

  const problem = passwordProblem(value);
  const canSubmit = problem === null && value.confirm.length > 0 && !working;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setWorking(true);
    setFailure(undefined);

    const result = await setPassword(value.password);

    if (!result.ok) {
      setFailure(result.failure);
      setWorking(false);
      return;
    }

    // refresh() so the server re-renders the header with the new session state
    // rather than reusing the cached signed-out shell.
    router.replace(destination);
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <PasswordFields value={value} onChange={setValue} disabled={working} />

      {failure && (
        <AuthMessage tone="error" title={failure.title}>
          {failure.body}
        </AuthMessage>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {working ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
