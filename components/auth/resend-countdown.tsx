'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * A resend button that will not let you make things worse.
 *
 * The original failure looked like this from the user's side: click the link,
 * land signed out, assume the email failed, request another — and another —
 * until Supabase started returning 429, at which point the app said "we could
 * not send that link", which read as confirmation that the emails were broken.
 *
 * So the button disables itself for a visible, counted period. A number that
 * ticks down is doing two jobs: it stops the retry loop, and it tells the user
 * the system is working normally rather than failing.
 */

export function ResendCountdown({
  seconds,
  onResend,
  pending,
  label = 'Send it again',
}: {
  /**
   * How long to wait before enabling.
   *
   * To restart the countdown after another send, give the component a new
   * `key` — remounting is how it resets, rather than an effect writing state
   * back, which would be a cascading render.
   */
  seconds: number;
  onResend: () => void;
  pending?: boolean;
  label?: string;
}) {
  const [remaining, setRemaining] = useState(seconds);
  // Reading the clock during render is impure, and the difference between
  // stamping it here and one frame later is imperceptible.
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    // Stamped here rather than during render: reading the clock while
    // rendering is impure. The initial state already holds the full duration,
    // so there is nothing to set synchronously — the first tick corrects it.
    startedAt.current = Date.now();

    const timer = setInterval(() => {
      const from = startedAt.current;
      if (from === null) return;
      const elapsed = Math.floor((Date.now() - from) / 1000);
      setRemaining(Math.max(0, seconds - elapsed));
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const waiting = remaining > 0;

  return (
    <div>
      <Button
        type="button"
        variant="secondary"
        onClick={onResend}
        disabled={waiting || pending}
        aria-describedby={waiting ? 'resend-countdown' : undefined}
      >
        {pending ? 'Sending…' : label}
      </Button>

      {/* Polite, not assertive: a number changing every second must not
          interrupt someone reading the rest of the page. */}
      <p
        id="resend-countdown"
        aria-live="polite"
        className="text-text-subtle mt-2 text-sm tabular-nums"
      >
        {waiting
          ? `You can request another in ${remaining} second${remaining === 1 ? '' : 's'}.`
          : 'Did not arrive? Check your spam folder first.'}
      </p>
    </div>
  );
}
