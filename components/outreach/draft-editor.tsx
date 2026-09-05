'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';

/**
 * The draft editor: text on the left, its grounding on the right.
 *
 * Every edit becomes a version and resets approval; approval demands the
 * reviewed checkbox and a clean lint; the copy button exists only once a
 * human has approved, and the copy is recorded. Arabic drafts render
 * right-to-left — direction belongs to the text, not the chrome.
 */

export interface DraftView {
  id: string;
  channel: string;
  channelLabel: string;
  language: 'en' | 'ar';
  body: string;
  status: 'draft' | 'approved' | 'rejected';
  version: number;
  evidenceRefs: { kind: string; text: string }[];
}

export interface ViolationView {
  kind: string;
  excerpt: string;
  message: string;
}

export interface VersionView {
  version: number;
  createdAt: string;
}

export function DraftEditor({
  draft,
  violations: initialViolations,
  versions,
}: {
  draft: DraftView;
  violations: ViolationView[];
  versions: VersionView[];
}) {
  const router = useRouter();
  const [body, setBody] = useState(draft.body);
  const [violations, setViolations] = useState(initialViolations);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dirty = body !== draft.body;

  async function saveEdit() {
    if (busy || !dirty) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/outreach/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'The edit could not be saved.');
        return;
      }
      setViolations(payload.violations ?? []);
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'approve' | 'reject') {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/outreach/${draft.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reviewed }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'The decision could not be saved.');
        return;
      }
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setCopied(false);
    try {
      const response = await fetch(`/api/outreach/${draft.id}/copy`, {
        method: 'POST',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'The draft could not be copied.');
        return;
      }
      await navigator.clipboard.writeText(payload.body as string);
      setCopied(true);
    } catch {
      setFailure('Copying to the clipboard failed. Select the text and copy it by hand.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div>
        <label
          htmlFor="draft-body"
          className="text-text mb-2 block text-[13px] font-medium"
        >
          {draft.channelLabel} — version {draft.version}
        </label>
        <textarea
          id="draft-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={16}
          dir={draft.language === 'ar' ? 'rtl' : 'ltr'}
          lang={draft.language}
          maxLength={4000}
          className="border-rule-strong bg-ground-raised text-text w-full border px-4 py-3 text-[14px] leading-relaxed"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !dirty}
            onClick={() => void saveEdit()}
          >
            Save edit
          </Button>
          {draft.status !== 'approved' ? (
            <>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(event) => setReviewed(event.target.checked)}
                  className="accent-[var(--color-signal)]"
                />
                <span className="text-text-muted text-[13px]">
                  I have reviewed this draft and stand behind every claim in it
                </span>
              </label>
              <Button
                size="sm"
                disabled={busy || dirty || !reviewed || violations.length > 0}
                onClick={() => void decide('approve')}
              >
                Approve
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void decide('reject')}
              >
                Reject
              </Button>
            </>
          ) : (
            <>
              <Meta role="status">Approved — nothing sends automatically</Meta>
              <Button size="sm" disabled={busy} onClick={() => void copy()}>
                {copied ? 'Copied' : 'Copy to send by hand'}
              </Button>
            </>
          )}
        </div>
        {dirty && (
          <p className="text-text-subtle mt-2 text-[12px]">
            Unsaved changes. Saving creates a new version and resets any approval.
          </p>
        )}
        {failure && (
          <p role="alert" className="text-copper mt-3 text-[13px]">
            {failure}
          </p>
        )}
      </div>

      <div>
        {violations.length > 0 && (
          <Panel className="border-copper/40 mb-6 p-5">
            <Meta>Unsupported claims</Meta>
            <ul className="mt-2 space-y-2">
              {violations.map((violation) => (
                <li key={`${violation.kind}-${violation.excerpt}`}>
                  <p className="text-copper text-[13px] font-medium">
                    “{violation.excerpt}”
                  </p>
                  <p className="text-text-muted text-[12px] leading-relaxed">
                    {violation.message}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Rule label="What this draft is built from" />
        {draft.evidenceRefs.length === 0 ? (
          <p className="text-text-muted mt-3 text-[13px] leading-relaxed">
            No evidence attached: this draft makes no claims about the account beyond the
            approach itself.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {draft.evidenceRefs.map((ref, index) => (
              <li key={`${ref.kind}-${index}`}>
                <Meta>{ref.kind.replace(/_/g, ' ')}</Meta>
                <p className="text-text-muted mt-0.5 text-[13px] leading-relaxed">
                  {ref.text}
                </p>
              </li>
            ))}
          </ul>
        )}

        {versions.length > 1 && (
          <>
            <Rule label="Versions" className="mt-8" />
            <ul className="mt-3 space-y-1">
              {versions.map((version) => (
                <li
                  key={version.version}
                  className="text-text-subtle text-[12px]"
                  data-numeric
                >
                  Version {version.version} —{' '}
                  {version.createdAt.slice(0, 16).replace('T', ' ')}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
