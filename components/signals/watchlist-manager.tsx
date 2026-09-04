'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { Rule } from '@/components/ui/panel';
import { SIGNAL_KIND_LABEL, type SignalKind } from '@/schemas/signals';

/**
 * The member's watchlists and their signal feed.
 *
 * Checking is explicit and bounded — a button, not a background job — and
 * the server enforces both the per-watch daily bound and the shared
 * research budget. A signal is something to read; nothing here sends,
 * schedules or contacts anything.
 */

export interface WatchlistView {
  id: string;
  name: string;
  kind: 'account' | 'segment';
  subjectLabel: string;
  lastCheckedOn: string | null;
  checksToday: number;
}

export interface SignalView {
  id: string;
  watchlistName: string;
  accountId: string | null;
  kind: SignalKind;
  title: string;
  url: string;
  sourceHost: string;
  excerpt: string | null;
  createdAt: string;
}

export function WatchlistManager({
  watchlists,
  signals,
  segments,
  territories,
}: {
  watchlists: WatchlistView[];
  signals: SignalView[];
  segments: { key: string; label: string }[];
  territories: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [segmentKey, setSegmentKey] = useState(segments[0]?.key ?? '');
  const [territoryKey, setTerritoryKey] = useState(territories[0]?.key ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function call(path: string, init: RequestInit, failureText: string) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      const response = await fetch(path, init);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? failureText);
        return null;
      }
      router.refresh();
      return payload;
    } catch {
      setFailure('We could not reach the server. Try again.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createWatch() {
    if (!name.trim()) return;
    const payload = await call(
      '/api/watchlists',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, kind: 'segment', segmentKey, territoryKey }),
      },
      'The watch could not be created.',
    );
    if (payload) setName('');
  }

  async function checkNow(id: string) {
    const payload = await call(
      `/api/watchlists/${id}/check`,
      { method: 'POST' },
      'The check could not run.',
    );
    if (payload?.outcome) {
      const { added, duplicates, skipped } = payload.outcome;
      setNotice(
        `${added} new signal${added === 1 ? '' : 's'}; ${duplicates} already known; ${skipped} result${skipped === 1 ? '' : 's'} skipped for not naming the subject.`,
      );
    }
  }

  return (
    <div>
      {notice && (
        <p role="status" className="text-text-muted mb-4 text-[13px]">
          {notice}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-copper mb-4 text-[13px]">
          {failure}
        </p>
      )}

      {watchlists.length === 0 ? (
        <p className="text-text-muted text-[14px] leading-relaxed">
          No watches yet. Watch an account from its page, or watch a segment in a
          territory below.
        </p>
      ) : (
        <ul className="border-rule divide-rule divide-y border">
          {watchlists.map((watchlist) => (
            <li
              key={watchlist.id}
              className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-text text-[14px] font-medium">{watchlist.name}</p>
                <p className="text-text-subtle text-[12px]">{watchlist.subjectLabel}</p>
              </div>
              <span className="text-text-subtle text-[12px]">
                {watchlist.lastCheckedOn
                  ? `Checked ${watchlist.checksToday} time${watchlist.checksToday === 1 ? '' : 's'} on ${watchlist.lastCheckedOn}`
                  : 'Never checked'}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void checkNow(watchlist.id)}
                >
                  Check now
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void call(
                      `/api/watchlists/${watchlist.id}`,
                      { method: 'DELETE' },
                      'The watch could not be removed.',
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Rule label="Watch a segment" className="mt-10" />
      <form
        className="mt-4 flex max-w-3xl flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void createWatch();
        }}
      >
        <div className="min-w-0 flex-1">
          <TextField
            label="Name the watch"
            name="watchName"
            value={name}
            onChange={setName}
          />
        </div>
        <div>
          <label
            htmlFor="watch-segment"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Segment
          </label>
          <select
            id="watch-segment"
            value={segmentKey}
            onChange={(event) => setSegmentKey(event.target.value)}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[13px]"
          >
            {segments.map((segment) => (
              <option key={segment.key} value={segment.key}>
                {segment.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="watch-territory"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Territory
          </label>
          <select
            id="watch-territory"
            value={territoryKey}
            onChange={(event) => setTerritoryKey(event.target.value)}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2.5 text-[13px]"
          >
            {territories.map((territory) => (
              <option key={territory.key} value={territory.key}>
                {territory.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={busy || !name.trim()}>
          Watch
        </Button>
      </form>

      <Rule label="Signals" className="mt-12" />
      {signals.length === 0 ? (
        <p className="text-text-muted mt-4 text-[14px] leading-relaxed">
          Nothing observed yet. Signals appear here when a check finds a page that names a
          watched subject.
        </p>
      ) : (
        <ul className="border-rule divide-rule mt-4 divide-y border">
          {signals.map((signal) => (
            <li key={signal.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="border-rule text-text-subtle border px-1.5 py-0.5 text-[11px] tracking-wide uppercase">
                  {SIGNAL_KIND_LABEL[signal.kind]}
                </span>
                <p className="text-text min-w-0 flex-1 text-[14px]">{signal.title}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void call(
                      `/api/signals/${signal.id}`,
                      { method: 'PATCH' },
                      'The signal could not be dismissed.',
                    )
                  }
                >
                  Dismiss
                </Button>
              </div>
              {signal.excerpt && (
                <p className="text-text-muted mt-1 text-[13px]">{signal.excerpt}</p>
              )}
              <p className="text-text-subtle mt-1 text-[12px]">
                {signal.watchlistName} · observed on {signal.sourceHost} ·{' '}
                <a
                  href={signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  source
                </a>
                {signal.accountId && (
                  <>
                    {' · '}
                    <Link
                      href={`/leads/${signal.accountId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      account
                    </Link>
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
