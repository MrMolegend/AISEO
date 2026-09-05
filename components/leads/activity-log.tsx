'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ACTIVITY_KINDS } from '@/schemas/pipeline';

/**
 * The activity timeline and its entry form. Private notes are marked and
 * visible only to their author — the server filters, this component only
 * renders what it was given.
 */

export interface ActivityView {
  id: string;
  kind: string;
  body: string;
  private: boolean;
  authorName: string;
  happenedAt: string;
}

export function ActivityLog({
  accountId,
  activities,
}: {
  accountId: string;
  activities: ActivityView[];
}) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<string>('note');
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function add() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountId, kind, body, private: isPrivate }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFailure(payload?.message ?? 'The note could not be saved.');
        return;
      }
      setBody('');
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="activity-body"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Record what happened
          </label>
          <input
            id="activity-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            placeholder="Call summary, meeting outcome, note…"
            className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
          />
        </div>
        <div>
          <label
            htmlFor="activity-kind"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Kind
          </label>
          <select
            id="activity-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[14px]"
          >
            {ACTIVITY_KINDS.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2.5">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => setIsPrivate(event.target.checked)}
            className="accent-[var(--color-signal)]"
          />
          <span className="text-text-muted text-[13px]">Private to me</span>
        </label>
        <Button type="submit" variant="secondary" disabled={busy || !body.trim()}>
          Add
        </Button>
      </form>
      {failure && (
        <p role="alert" className="text-copper mt-2 text-[13px]">
          {failure}
        </p>
      )}

      {activities.length > 0 && (
        <ol className="border-rule divide-rule mt-6 divide-y border">
          {activities.map((activity) => (
            <li key={activity.id} className="px-4 py-3">
              <p className="text-text text-[13px] leading-relaxed">{activity.body}</p>
              <p className="text-text-subtle mt-1 text-[12px]" data-numeric>
                {activity.kind} · {activity.authorName} ·{' '}
                {activity.happenedAt.slice(0, 16).replace('T', ' ')}
                {activity.private ? ' · private to you' : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
