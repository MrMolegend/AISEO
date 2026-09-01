'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/panel';
import { STAGES, type StoredStageId } from '@/lib/jobs/stages';
import { cn } from '@/lib/utils';

/**
 * The live research screen.
 *
 * Two rules shape it, and the first one is why the previous version had to go.
 *
 * **It never invents progress.** Every stage shown is a stage the server
 * actually writes, from the same exported list the runner uses — so the screen
 * structurally cannot display a step that does not happen. The old pipeline
 * wrote a "reading the sources we found" stage while performing no retrieval at
 * all, which is the exact failure this arrangement is meant to prevent and did
 * not. There is also no percentage anywhere: a twelve-query search phase and a
 * single synthesis call are minutes apart, so any number derived from position
 * is a number the product made up, and it produces the bar that sits at 94%
 * while nothing happens.
 *
 * **It survives leaving.** The job runs on the server; this page is a view of
 * it. Closing the tab, refreshing, or coming back tomorrow all work, and the
 * copy says so rather than warning people not to navigate away.
 */

interface StatusPayload {
  status: string;
  stage: StoredStageId;
  stageLabel: string;
  stageIndex: number;
  stageCount: number;
  done: boolean;
  subject: string;
  sourcesFound: number;
  errorCode?: string;
  error?: { title: string; body: string; retryable: boolean };
}

/** Slow enough not to hammer the server, fast enough to feel live. */
const POLL_INTERVAL_MS = 2_500;

export function ProcessingScreen({
  publicId,
  initialStage,
  subject,
  packageName,
}: {
  publicId: string;
  initialStage: StoredStageId;
  subject: string;
  packageName: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<StoredStageId>(initialStage);
  const [sources, setSources] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [offline, setOffline] = useState(false);
  const [failed, setFailed] = useState<StatusPayload['error'] | null>(null);

  // Stamped in an effect rather than during render: reading the clock while
  // rendering is impure, and the difference is one frame nobody can perceive.
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const response = await fetch(`/api/research/${publicId}/status`, {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(String(response.status));

        const payload = (await response.json()) as StatusPayload;
        if (cancelled) return;

        setStage(payload.stage);
        setSources(payload.sourcesFound);
        setOffline(false);

        if (payload.done) {
          if (payload.status === 'complete') {
            // Re-render the server component, which now has a report to show.
            router.refresh();
          } else {
            setFailed(payload.error ?? null);
          }
          return;
        }
      } catch {
        /*
         * A dropped poll is not a failed job.
         *
         * The research runs on the server whether or not this tab can reach
         * it, so a lost connection is reported as exactly that and the polling
         * continues. Treating it as a failure would tell someone their paid
         * report had died because their train went into a tunnel.
         */
        if (!cancelled) setOffline(true);
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [publicId, router]);

  useEffect(() => {
    startedAt.current ??= Date.now();
    const timer = setInterval(() => {
      const from = startedAt.current;
      if (from !== null) setElapsed(Math.floor((Date.now() - from) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (failed) return <FailureState error={failed} />;

  const currentIndex = STAGES.findIndex((entry) => entry.id === stage);

  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-12 md:py-16">
      <Meta>{packageName}</Meta>
      <h1 className="font-display text-text mt-3 text-[30px] leading-tight md:text-[36px]">
        Researching {subject}
      </h1>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-text-muted mt-3 text-[15px] leading-relaxed"
      >
        {STAGES[currentIndex]?.label ?? 'Working'}
        {currentIndex >= 0 && (
          <span className="text-text-faint">
            {' '}
            · step {currentIndex + 1} of {STAGES.length}
          </span>
        )}
      </p>

      {/*
       * The route the research travels, drawn as the stages themselves.
       * Completed steps are filled, the current one pulses, and the ones ahead
       * are outlines — an indeterminate state that is honest about not knowing
       * how long the current step will take.
       */}
      <ol className="mt-10">
        {STAGES.map((entry, index) => {
          const state =
            index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'ahead';
          return (
            <li
              key={entry.id}
              className="flex gap-4"
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {/* The rail: a marker and the line connecting it to the next. */}
              <div
                aria-hidden="true"
                className="flex w-4 shrink-0 flex-col items-center pt-1.5"
              >
                <span
                  className={cn(
                    'block h-2.5 w-2.5 shrink-0',
                    state === 'done' && 'bg-signal',
                    state === 'active' && 'bg-signal animate-node',
                    state === 'ahead' && 'border-rule-strong border',
                  )}
                />
                {index < STAGES.length - 1 && (
                  <span
                    className={cn(
                      'mt-1 w-px flex-1',
                      index < currentIndex ? 'bg-signal-dim' : 'bg-rule',
                    )}
                  />
                )}
              </div>

              <div className="pb-6">
                <p
                  className={cn(
                    'text-[15px]',
                    state === 'ahead' && 'text-text-faint',
                    state === 'active' && 'text-text font-medium',
                    state === 'done' && 'text-text-muted',
                  )}
                >
                  {entry.label}
                  {state === 'done' && <span className="sr-only"> — done</span>}
                  {state === 'active' && <span className="sr-only"> — in progress</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="border-rule mt-4 grid gap-6 border-t pt-6 sm:grid-cols-2">
        <div>
          <Meta>Elapsed</Meta>
          <p className="text-text mt-1 text-[15px]" data-numeric>
            {formatElapsed(elapsed)}
          </p>
        </div>
        <div>
          <Meta>Sources found</Meta>
          <p className="text-text mt-1 text-[15px]" data-numeric>
            {sources}
          </p>
        </div>
      </div>

      {offline && (
        <p role="status" className="text-copper mt-6 text-[13px] leading-relaxed">
          We have lost contact with the server and are still trying. The research is
          running regardless — it does not depend on this page staying open.
        </p>
      )}

      <p className="text-text-muted mt-8 text-[14px] leading-relaxed">
        This runs on our servers, so you can close this page and come back. The link works
        from the moment it was created, and it is in{' '}
        <Link href="/dashboard" className="text-cobalt underline underline-offset-4">
          your Intelligence Desk
        </Link>{' '}
        too.
      </p>
    </div>
  );
}

function FailureState({ error }: { error: NonNullable<StatusPayload['error']> }) {
  return (
    <div className="mx-auto max-w-[var(--container-narrow)] py-16">
      <div
        role="alert"
        className="border-copper-line bg-copper-surface border-l-[3px] p-6 md:p-8"
      >
        <h1 className="font-display text-text text-[24px] leading-tight">
          {error.title}
        </h1>
        <p className="text-text-muted mt-3 text-[15px] leading-relaxed">{error.body}</p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/assess">Start a new assessment</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/dashboard">Back to the desk</Link>
        </Button>
      </div>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) return `${remainder}s`;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}
