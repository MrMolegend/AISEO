'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * The fast relationship workflow beside a contact:
 * Confirm direct / Know indirectly / Not connected, with an optional note.
 *
 * A member speaks only for themselves — the server writes the edge under
 * the caller's identity, and no verb here can produce an "official API"
 * state. Existing workspace-visible paths render above the controls with
 * their exact provenance sentence.
 */

export function RelationshipConfirm({
  contactId,
  sentences,
  ownState,
}: {
  contactId: string;
  /** Provenance sentences for existing workspace-visible edges. */
  sentences: string[];
  /** The caller's own current state for this contact, if any. */
  ownState: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function attest(action: 'confirm_direct' | 'know_indirectly' | 'not_connected') {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/relationships', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contactId, action, note }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFailure(payload?.message ?? 'That did not save.');
        return;
      }
      setNote('');
      setShowNote(false);
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2">
      {sentences.length > 0 && (
        <ul className="space-y-1">
          {/* The warm-path reveal: each confirmed path fades in, in order. */}
          {sentences.map((sentence, index) => (
            <li
              key={sentence}
              className="text-text-muted animate-fade text-[13px] leading-relaxed"
              style={{ '--fade-index': index } as React.CSSProperties}
            >
              {sentence}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-text-subtle text-[12px]">
          {ownState
            ? 'Your answer is on record — you can change it:'
            : 'Do you know this person?'}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void attest('confirm_direct')}
        >
          Yes, directly
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void attest('know_indirectly')}
        >
          Indirectly
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => void attest('not_connected')}
        >
          Not connected
        </Button>
        <button
          type="button"
          onClick={() => setShowNote((current) => !current)}
          className="text-text-subtle text-[12px] underline-offset-2 hover:underline"
        >
          {showNote ? 'Hide context' : 'Add context'}
        </button>
      </div>

      {showNote && (
        <div className="mt-2 max-w-md">
          <label htmlFor={`rel-note-${contactId}`} className="sr-only">
            Context for your answer
          </label>
          <input
            id={`rel-note-${contactId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="How you know them, or why not"
            className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2 text-[13px]"
          />
        </div>
      )}

      {failure && (
        <p role="alert" className="text-copper mt-2 text-[13px]">
          {failure}
        </p>
      )}
    </div>
  );
}
