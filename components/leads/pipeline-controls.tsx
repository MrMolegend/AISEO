'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABEL,
  type PipelineStage,
} from '@/schemas/pipeline';

/**
 * Stage movement and playbooks, on the account itself.
 *
 * A move can carry a note; reopening a settled account requires one (the
 * server refuses otherwise). Applying a playbook creates its checklist
 * idempotently and says how many steps already existed.
 */
export function PipelineControls({
  accountId,
  currentStage,
  playbooks,
}: {
  accountId: string;
  currentStage: string | null;
  playbooks: { key: string; name: string }[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState<string>(currentStage ?? 'discovered');
  const [note, setNote] = useState('');
  const [playbookKey, setPlaybookKey] = useState(playbooks[0]?.key ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function move() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/pipeline/${accountId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage, note }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'The move could not be saved.');
        return;
      }
      setNote('');
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (busy || !playbookKey) return;
    setBusy(true);
    setFailure(null);
    setMessage(null);
    try {
      const response = await fetch('/api/playbooks/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountId, playbookKey }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setFailure(payload?.message ?? 'The playbook could not be applied.');
        return;
      }
      setMessage(
        `${payload.created.length} task${payload.created.length === 1 ? '' : 's'} created` +
          (payload.existing > 0 ? `; ${payload.existing} already existed.` : '.'),
      );
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-wrap items-end gap-x-6 gap-y-4">
      <div>
        <label
          htmlFor="pipeline-stage"
          className="text-text mb-2 block text-[13px] font-medium"
        >
          Pipeline stage
        </label>
        {/* Wraps: on a phone the note input takes its own line instead of
            overflowing the row and sitting over the Move button. */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="pipeline-stage"
            value={stage}
            onChange={(event) => setStage(event.target.value as PipelineStage)}
            className="border-rule-strong bg-ground-raised text-text border px-3 py-2 text-[13px]"
          >
            {PIPELINE_STAGES.map((value) => (
              <option key={value} value={value}>
                {PIPELINE_STAGE_LABEL[value]}
              </option>
            ))}
          </select>
          <input
            aria-label="Why this move"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            placeholder="Why (kept in history)"
            className="border-rule-strong bg-ground-raised text-text w-52 max-w-full border px-3 py-2 text-[13px]"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || stage === currentStage}
            onClick={() => void move()}
          >
            Move
          </Button>
        </div>
      </div>

      {playbooks.length > 0 && (
        <div>
          <label
            htmlFor="playbook-key"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Playbook
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="playbook-key"
              value={playbookKey}
              onChange={(event) => setPlaybookKey(event.target.value)}
              className="border-rule-strong bg-ground-raised text-text border px-3 py-2 text-[13px]"
            >
              {playbooks.map((playbook) => (
                <option key={playbook.key} value={playbook.key}>
                  {playbook.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void apply()}
            >
              Apply as tasks
            </Button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="text-text-muted w-full text-[13px]">
          {message}
        </p>
      )}
      {failure && (
        <p role="alert" className="text-copper w-full text-[13px]">
          {failure}
        </p>
      )}
    </div>
  );
}
