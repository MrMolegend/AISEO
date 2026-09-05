'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * The campaign-run stall sweep, behind a confirmation. Idempotent
 * server-side; the confirmation exists so a slipped click cannot fail a
 * run someone is watching.
 */
export function RepairCampaignsButton({ count }: { count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function sweep() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/repair-campaigns', { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        setNotice(
          `Examined ${payload?.examined ?? 0} stalled run${payload?.examined === 1 ? '' : 's'}.`,
        );
        router.refresh();
      } else {
        setNotice(payload?.message ?? 'The sweep did not run.');
      }
    } catch {
      setNotice('We could not reach the server.');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      {notice && (
        <span role="status" className="text-text-subtle text-[13px]">
          {notice}
        </span>
      )}
      {confirming ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void sweep()}
          >
            Yes, fail stalled runs
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          disabled={busy || count === 0}
          onClick={() => setConfirming(true)}
        >
          Repair stalled campaign runs
        </Button>
      )}
    </span>
  );
}
