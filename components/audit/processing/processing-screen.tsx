'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LoaderCircle } from 'lucide-react';
import { STAGES, type StageId } from '@/lib/pipeline/stages';
import { cn } from '@/lib/utils';

/**
 * The processing screen.
 *
 * Every stage shown here comes from the same STAGES list the pipeline advances
 * through, so the UI cannot display work the server is not doing. There is no
 * synthetic percentage between stages — the current stage shimmers, completed
 * ones get a check, future ones sit dimmed. That is the honest amount of
 * information we actually have.
 */

interface StatusResponse {
  status: 'queued' | 'running' | 'complete' | 'failed';
  stage: StageId;
  stageIndex: number;
  error?: { title: string; body: string; retryable: boolean };
}

const POLL_INTERVAL_MS = 1_500;
/** Stop polling well before a hung pipeline would keep a tab busy forever. */
const MAX_POLL_MS = 300_000;

export function ProcessingScreen({
  publicId,
  domain,
  initialStageIndex,
}: {
  publicId: string;
  domain: string;
  initialStageIndex: number;
}) {
  const router = useRouter();
  const [stageIndex, setStageIndex] = useState(initialStageIndex);
  const [elapsed, setElapsed] = useState(0);
  const [stalled, setStalled] = useState(false);
  // Initialised in an effect rather than during render: Date.now() is impure,
  // and calling it in a render body is both a lint error under the React
  // Compiler rules and a real hazard if the component ever re-renders before
  // mount.
  const startedAt = useRef<number | null>(null);

  // Elapsed timer, independent of polling so it stays smooth.
  useEffect(() => {
    startedAt.current ??= Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;

      startedAt.current ??= Date.now();
      if (Date.now() - startedAt.current > MAX_POLL_MS) {
        setStalled(true);
        return;
      }

      try {
        const response = await fetch(`/api/audits/${publicId}/status`, {
          cache: 'no-store',
        });

        if (response.ok) {
          const data = (await response.json()) as StatusResponse;
          if (cancelled) return;

          setStageIndex(data.stageIndex);

          if (data.status === 'complete' || data.status === 'failed') {
            // The server component re-renders with the report or the error
            // state; this component unmounts as a result.
            router.refresh();
            return;
          }
        }
      } catch {
        // A dropped poll is not a failure — the next one will catch up.
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    };

    startedAt.current ??= Date.now();
    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [publicId, router]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[480px] flex-col justify-center px-5 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Auditing {domain}</h1>
        <p className="text-ink-muted mt-2 text-[15px]">
          This usually takes under a minute. You can leave this page open — the report
          stays at this address.
        </p>
      </div>

      <ol className="mt-10 space-y-1" aria-live="polite">
        {STAGES.map((stage, index) => {
          const done = index < stageIndex;
          const active = index === stageIndex;

          return (
            <li
              key={stage.id}
              className={cn(
                'flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 transition-opacity',
                !done && !active && 'opacity-40',
              )}
            >
              <span className="flex size-5 shrink-0 items-center justify-center">
                {done ? (
                  <Check className="size-4 text-[var(--color-score-good)]" aria-hidden />
                ) : active ? (
                  <LoaderCircle className="text-brand size-4 animate-spin" aria-hidden />
                ) : (
                  <span className="bg-ink-faint/40 size-1.5 rounded-full" aria-hidden />
                )}
              </span>

              <span
                className={cn(
                  'text-[15px]',
                  active ? 'text-ink font-medium' : 'text-ink-muted',
                )}
              >
                {stage.label}
              </span>

              {done ? <span className="sr-only">complete</span> : null}
            </li>
          );
        })}
      </ol>

      <p className="text-ink-faint mt-8 text-center font-mono text-sm">
        {minutes > 0 ? `${minutes}m ` : ''}
        {seconds}s elapsed
      </p>

      {stalled ? (
        <div className="border-line bg-surface-subtle mt-6 rounded-[var(--radius-card)] border p-4 text-center">
          <p className="text-ink-muted text-sm">
            This is taking longer than expected. Refresh the page to check again — your
            audit is saved either way.
          </p>
        </div>
      ) : null}
    </div>
  );
}
