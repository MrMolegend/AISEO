'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Root error boundary.
 *
 * The user never sees the underlying message — it may contain internal detail —
 * only the digest, which is what support would ask for.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Client-side surface: the server has already logged this with full context.
    console.error('Unhandled application error', error.digest ?? error.message);
  }, [error]);

  return (
    <main
      id="main"
      className="mx-auto flex max-w-lg flex-col items-center px-5 py-28 text-center md:py-36"
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-[var(--color-copper-surface)]">
        <TriangleAlert className="size-5 text-[var(--color-copper)]" aria-hidden />
      </span>
      <h1 className="mt-5 text-3xl font-semibold md:text-4xl">
        Something unexpected went wrong
      </h1>
      <p className="text-text-muted mt-4 text-[17px] leading-relaxed">
        We have been notified and will look into it. Trying again often works.
      </p>
      {error.digest ? (
        <p className="text-text-faint mt-4 font-mono text-xs">
          Reference: {error.digest}
        </p>
      ) : null}
      <div className="mt-8 flex gap-3">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <Link href="/">
          <Button size="lg" variant="secondary">
            Back to home
          </Button>
        </Link>
      </div>
    </main>
  );
}
