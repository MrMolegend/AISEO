'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * Generates the standard first-touch set for one contact — intro request
 * (when an honest warm path exists), a LinkedIn note, a short email and a
 * call opener — and takes the person to the review queue. Suppressed
 * targets refuse server-side whatever this button hopes.
 */
export function DraftOutreachButton({
  accountId,
  contactId,
  language,
}: {
  accountId: string;
  contactId: string;
  language: 'en' | 'ar';
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId,
          contactId,
          channels: ['intro_request', 'linkedin_note', 'email_short', 'call_opener'],
          language,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'Drafts could not be generated.');
        return;
      }
      router.push('/outreach');
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-3">
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => void generate()}
      >
        {busy ? 'Drafting…' : 'Draft outreach'}
      </Button>
      {failure && (
        <span role="alert" className="text-copper text-[12px]">
          {failure}
        </span>
      )}
    </span>
  );
}
