'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * The stall sweep, behind a confirmation.
 *
 * Repair settles money (a refund per stalled run), so it asks once before
 * acting. It is idempotent server-side — pressing it twice cannot refund
 * twice — but a financial action should still not fire on a slipped click.
 */
export function RepairButton({ count }: { count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function sweep() {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/repair', { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (response.ok) {
        setNotice(
          `Examined ${payload?.examined ?? 0}, repaired ${payload?.repaired ?? 0}.`,
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

  if (count === 0 && !notice) return null;

  return (
    <span className="flex items-center gap-2">
      {notice && (
        <span role="status" className="text-text-subtle text-[12px]">
          {notice}
        </span>
      )}
      {confirming ? (
        <>
          <span className="text-text-subtle text-[13px]">
            Fail and refund {count} stalled {count === 1 ? 'run' : 'runs'}?
          </span>
          <Button size="sm" onClick={() => void sweep()} disabled={busy}>
            {busy ? 'Repairing…' : 'Yes, repair'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </>
      ) : (
        count > 0 && (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            Repair stalled runs
          </Button>
        )
      )}
    </span>
  );
}
