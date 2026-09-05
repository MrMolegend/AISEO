'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/panel';
import type { LeadStatus } from '@/schemas/campaign';

/**
 * Working controls for one account: status changes and self-assignment.
 *
 * The buttons only offer transitions that make sense from the current
 * status, and every change lands as an audited server write — the page
 * refreshes to the server's truth rather than trusting local state.
 */
export function AccountActions({
  accountId,
  status,
  ownerId,
  selfId,
  canWork,
}: {
  accountId: string;
  status: LeadStatus;
  ownerId: string | null;
  selfId: string;
  canWork: boolean;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/leads/${accountId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFailure(payload?.message ?? 'The change could not be saved.');
        return;
      }
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!canWork) return null;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        {status !== 'qualified' && (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => void patch({ status: 'qualified' })}
          >
            Mark qualified
          </Button>
        )}
        {status !== 'rejected' && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void patch({ status: 'rejected' })}
          >
            Reject
          </Button>
        )}
        {status !== 'research_needed' && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void patch({ status: 'research_needed' })}
          >
            Needs more research
          </Button>
        )}
        {ownerId !== selfId ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void patch({ ownerId: selfId })}
          >
            Assign to me
          </Button>
        ) : (
          <Meta>Assigned to you</Meta>
        )}
      </div>
      {failure && (
        <p role="alert" className="text-copper mt-3 text-[13px]">
          {failure}
        </p>
      )}
    </div>
  );
}
