'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rule } from '@/components/ui/panel';

/**
 * Manual merge, with its history and undo.
 *
 * Merging is a person's judgement that two rows are one business, so it
 * demands a written reason and stays reversible. The candidate list offers
 * only same-workspace accounts that are not already merged.
 */

export interface MergeCandidate {
  id: string;
  name: string;
}

export interface MergeHistoryEntry {
  id: string;
  winnerId: string;
  loserId: string;
  reason: string;
  undoneAt: string | null;
  createdAt: string;
}

export function MergePanel({
  accountId,
  candidates,
  history,
  nameOf,
}: {
  accountId: string;
  candidates: MergeCandidate[];
  history: MergeHistoryEntry[];
  nameOf: Record<string, string>;
}) {
  const router = useRouter();
  const [loserId, setLoserId] = useState('');
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/leads/${accountId}/merge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(
          payload?.issues?.[0]?.message ?? payload?.message ?? 'That did not save.',
        );
        return;
      }
      setLoserId('');
      setReason('');
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="merge-heading">
      <Rule label="Duplicates" className="mt-12" />
      <p id="merge-heading" className="text-text-muted mt-2 text-[13px]">
        Merge another row into this account when a person has judged they are the same
        business. The merged row is kept, marked, and reversible — never destroyed.
      </p>

      {history.length > 0 && (
        <ul className="border-rule divide-rule mt-4 divide-y border">
          {history.map((merge) => (
            <li
              key={merge.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <p className="text-text text-[13px]">
                  {nameOf[merge.loserId] ?? 'A row'} merged into{' '}
                  {nameOf[merge.winnerId] ?? 'this account'}
                  {merge.undoneAt && <span className="text-text-subtle"> — undone</span>}
                </p>
                <p className="text-text-subtle mt-0.5 text-[12px]">{merge.reason}</p>
              </div>
              {!merge.undoneAt && merge.winnerId === accountId && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void post({ action: 'undo', mergeId: merge.id })}
                >
                  Undo
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {candidates.length > 0 && (
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!loserId || !reason.trim()) {
              setFailure('Choose the duplicate row and say why they are the same.');
              return;
            }
            void post({ action: 'merge', loserId, reason });
          }}
        >
          <div>
            <label
              htmlFor="merge-loser"
              className="text-text mb-2 block text-[13px] font-medium"
            >
              Duplicate row
            </label>
            <select
              id="merge-loser"
              value={loserId}
              onChange={(event) => setLoserId(event.target.value)}
              className="border-rule-strong bg-ground-raised text-text max-w-64 border px-3 py-2.5 text-[14px]"
            >
              <option value="">Choose an account…</option>
              {candidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 flex-1 sm:max-w-md">
            <label
              htmlFor="merge-reason"
              className="text-text mb-2 block text-[13px] font-medium"
            >
              Why they are the same business
            </label>
            <input
              id="merge-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
              placeholder="Same trade licence, same shopfront, confirmed by phone…"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={busy}>
            Merge into this account
          </Button>
        </form>
      )}

      {failure && (
        <p role="alert" className="text-copper mt-3 text-[13px]">
          {failure}
        </p>
      )}
    </section>
  );
}
