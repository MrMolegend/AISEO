'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * One click puts this account on the caller's watchlist. Checking it later
 * is still explicit and budgeted — watching costs nothing by itself.
 */
export function WatchAccountButton({
  accountId,
  accountName,
}: {
  accountId: string;
  accountName: string;
}) {
  const [state, setState] = useState<'idle' | 'busy' | 'watching' | 'failed'>('idle');

  async function watch() {
    if (state === 'busy' || state === 'watching') return;
    setState('busy');
    try {
      const response = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: accountName.slice(0, 120),
          kind: 'account',
          accountId,
        }),
      });
      setState(response.ok ? 'watching' : 'failed');
    } catch {
      setState('failed');
    }
  }

  if (state === 'watching') {
    return (
      <p role="status" className="text-text-muted text-[13px]">
        Watching. Check it from the watchlists page.
      </p>
    );
  }
  return (
    <span className="inline-flex items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={state === 'busy'}
        onClick={() => void watch()}
      >
        Watch this account
      </Button>
      {state === 'failed' && (
        <span role="alert" className="text-copper text-[13px]">
          Could not create the watch.
        </span>
      )}
    </span>
  );
}
