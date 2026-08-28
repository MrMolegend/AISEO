'use client';

import { useEffect } from 'react';
import { LogoMark } from '@/components/brand/logo';
import { Button, ButtonLink } from '@/components/ui/button';

/**
 * The last line of defence. It never shows the raw error to the visitor — the
 * digest is enough for support to find it in the logs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error', error);
  }, [error]);

  return (
    <div className="container-narrow flex min-h-dvh flex-col items-center justify-center py-16 text-center">
      <LogoMark className="size-10" />
      <p className="text-ink-subtle mt-6 text-sm font-medium">Something went wrong</p>
      <h1 className="mt-2 text-[1.75rem] tracking-[var(--tracking-tight)]">
        This page did not load properly
      </h1>
      <p className="text-ink-muted mt-3 max-w-md leading-relaxed">
        Nothing you have done has been lost. Try again, and if it keeps happening let us
        know what you were doing at the time.
      </p>
      {error.digest && (
        <p className="text-ink-subtle mt-3 font-mono text-xs">Reference {error.digest}</p>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <Button size="lg" onClick={reset}>
          Try again
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg">
          Back to the homepage
        </ButtonLink>
      </div>
    </div>
  );
}
