'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { STAGES, type StageId } from '@/lib/jobs/stages';

/**
 * The progress screen.
 *
 * Two rules shape it.
 *
 * It never invents progress. Every stage shown is a stage the server actually
 * writes — they come from the same exported list the runner uses, so the screen
 * cannot display a step that does not happen. Within the current stage the
 * indicator is indeterminate rather than a creeping percentage, because we do
 * not know how long a crawl will take and a bar that sits at 94% is a lie the
 * user can feel.
 *
 * It survives leaving. The job runs on the server; this page is a view of it.
 * Closing the tab, refreshing, or coming back tomorrow all work, and the copy
 * says so rather than warning people not to navigate away.
 */

interface StatusPayload {
  status: string;
  stage: StageId;
  stageLabel: string;
  stageIndex: number;
  progress: number;
  done: boolean;
  subject: string;
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
  initialStage: StageId;
  subject: string;
  packageName: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<StageId>(initialStage);
  const [elapsed, setElapsed] = useState(0);
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
        // A dropped poll is not a failed job. Keep trying; the job is running
        // on the server regardless of whether this tab can reach it.
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

  if (failed) {
    return <FailureState error={failed} />;
  }

  const currentIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="mx-auto max-w-[520px] py-10">
      <p className="text-ink-subtle text-sm">{packageName}</p>
      <h1 className="text-ink mt-1 text-[26px] leading-tight font-semibold tracking-[var(--tracking-display)]">
        Researching {subject}
      </h1>

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-ink-muted mt-3 leading-relaxed"
      >
        {STAGES[currentIndex]?.label ?? 'Working'}
      </p>

      <ol className="mt-8 space-y-0.5">
        {STAGES.map((s, index) => {
          const state =
            index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending';

          return (
            <li
              key={s.id}
              className="flex items-center gap-3 py-1.5"
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span
                aria-hidden="true"
                className={
                  state === 'done'
                    ? 'bg-brand text-ink-inverse flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]'
                    : state === 'active'
                      ? 'border-brand bg-brand-subtle h-5 w-5 shrink-0 animate-pulse rounded-full border-2'
                      : 'border-line-strong h-5 w-5 shrink-0 rounded-full border'
                }
              >
                {state === 'done' ? '✓' : ''}
              </span>

              <span
                className={
                  state === 'pending'
                    ? 'text-ink-faint text-sm'
                    : state === 'active'
                      ? 'text-ink text-sm font-medium'
                      : 'text-ink-muted text-sm'
                }
              >
                {s.label}
                {state === 'done' && <span className="sr-only"> — done</span>}
                {state === 'active' && <span className="sr-only"> — in progress</span>}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="border-line mt-8 border-t pt-6">
        <p className="text-ink-subtle text-sm tabular-nums">
          {formatElapsed(elapsed)} elapsed
        </p>
        <p className="text-ink-muted mt-3 text-sm leading-relaxed">
          This runs on our servers, so you can close this page and come back. The link
          works from the moment it was created — it is in{' '}
          <Link
            href="/dashboard"
            className="text-brand focus-visible:ring-brand rounded underline underline-offset-4 focus-visible:ring-2 focus-visible:outline-none"
          >
            your dashboard
          </Link>{' '}
          too.
        </p>
      </div>
    </div>
  );
}

function FailureState({ error }: { error: NonNullable<StatusPayload['error']> }) {
  return (
    <div className="mx-auto max-w-[520px] py-10">
      <div
        role="alert"
        className="rounded-[var(--radius-card)] border border-[var(--color-severity-critical-line)] bg-[var(--color-severity-critical-bg)] p-6"
      >
        <h1 className="text-ink text-lg font-semibold">{error.title}</h1>
        <p className="text-ink-muted mt-2 leading-relaxed">{error.body}</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/research/new"
          className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand inline-flex h-11 items-center rounded-[var(--radius-control)] px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Start new research
        </Link>
        <Link
          href="/dashboard"
          className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-11 items-center rounded-[var(--radius-control)] border px-5 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          Back to dashboard
        </Link>
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
