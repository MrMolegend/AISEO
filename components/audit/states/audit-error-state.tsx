import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { renderErrorCopy, type ErrorCode } from '@/lib/errors';

/**
 * The designed failure state.
 *
 * Every path that can go wrong lands here with a specific explanation. Several
 * of these are genuinely useful findings in their own right — a site that is
 * slow, blocks automated tools, or renders entirely in the browser has just been
 * told something true about itself — so the copy leans into that rather than
 * apologising.
 */
export function AuditErrorState({
  code,
  domain,
}: {
  code: ErrorCode;
  domain: string | null;
}) {
  const copy = renderErrorCopy(code, domain);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[520px] flex-col justify-center px-5 py-16 text-center">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--color-severity-high-bg)]">
        <TriangleAlert className="size-5 text-[var(--color-severity-high)]" aria-hidden />
      </span>

      <h1 className="mt-5 text-2xl font-semibold md:text-3xl">{copy.title}</h1>
      <p className="text-ink-muted mt-3 text-[17px] leading-relaxed">{copy.body}</p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button size="lg">{copy.retryable ? 'Try again' : 'Audit another site'}</Button>
        </Link>
        <Link href="/sample">
          <Button size="lg" variant="secondary">
            See a sample report
          </Button>
        </Link>
      </div>

      <p className="text-ink-faint mt-8 font-mono text-xs">Reference: {code}</p>
    </div>
  );
}
