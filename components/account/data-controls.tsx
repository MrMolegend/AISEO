'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextField } from '@/components/ui/field';

/**
 * Export and deletion, on the account page.
 *
 * Export is a plain link — the route streams a JSON attachment. Deletion is
 * a two-step with a typed phrase: the phrase is the deliberate-intent check,
 * the copy above it is the honest statement of what goes and what that
 * means, and nothing about the flow is dressed up to be either scarier or
 * friendlier than it is.
 */

const CONFIRMATION = 'DELETE MY ACCOUNT';

export function DataControls() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function destroy() {
    if (busy || phrase !== CONFIRMATION) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirm: phrase }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'The account could not be deleted.');
        return;
      }
      setDone(true);
      // The auth user is gone; the session cookie now names nobody. Post
      // through the sign-out route so the cookie is cleared properly, then
      // land on the front page as the signed-out visitor this browser now is.
      await fetch('/auth/sign-out', { method: 'POST' }).catch(() => {});
      router.push('/');
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Nothing was deleted.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="text-text mt-4 text-[14px]">
        Your account has been deleted. Signing you out…
      </p>
    );
  }

  return (
    <>
      <section aria-labelledby="export-heading" className="mt-12">
        <h2 id="export-heading" className="sr-only">
          Export your data
        </h2>
        <Rule label="Take your data with you" />
        <p className="text-text-muted mt-4 text-[14px] leading-relaxed">
          One JSON file with your business profiles, drafts, assessments and their
          reports, saved scenarios, actions, feedback and credit history.
        </p>
        <div className="mt-4">
          <Button variant="secondary" size="sm" asChild>
            <a href="/api/account/export" download>
              Download my data
            </a>
          </Button>
        </div>
      </section>

      <section aria-labelledby="delete-heading" className="mt-12">
        <h2 id="delete-heading" className="sr-only">
          Delete your account
        </h2>
        <Rule label="Delete this account" />
        <p className="text-text-muted mt-4 text-[14px] leading-relaxed">
          Deletion removes your profiles, drafts, assessments and reports, scenarios,
          actions, feedback, credit balance and credit history, and revokes every share
          link immediately. It cannot be undone, and unspent credits are not transferable.
          Consider downloading your data first.
        </p>

        {!confirming ? (
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              Delete my account…
            </Button>
          </div>
        ) : (
          <div className="border-copper-line mt-4 max-w-[480px] border-l-[3px] pl-4">
            <TextField
              label={`Type “${CONFIRMATION}” to confirm`}
              name="deleteConfirmation"
              value={phrase}
              onChange={setPhrase}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={busy || phrase !== CONFIRMATION}
                onClick={() => void destroy()}
              >
                {busy ? 'Deleting…' : 'Delete everything'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setPhrase('');
                  setFailure(null);
                }}
              >
                Keep my account
              </Button>
            </div>
            {failure && (
              <p role="alert" className="text-copper mt-3 text-[13px]">
                {failure}
              </p>
            )}
            <Meta className="mt-3 block">
              The phrase is the confirmation step — nothing happens without it.
            </Meta>
          </div>
        )}
      </section>
    </>
  );
}
