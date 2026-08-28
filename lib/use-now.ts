'use client';

import { useEffect, useState } from 'react';

/**
 * The current time, but only after mount.
 *
 * Reading the clock during render is both impure and a hydration hazard — the
 * server and the browser would disagree. This returns `null` on the first
 * render so a component can show a placeholder, then the real time, optionally
 * ticking.
 */
export function useNow(intervalMs?: number): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    if (!intervalMs) return () => cancelAnimationFrame(frame);

    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return now;
}
