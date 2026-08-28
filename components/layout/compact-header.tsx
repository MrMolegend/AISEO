import Link from 'next/link';
import { X } from 'lucide-react';
import { Logo } from '@/components/brand/logo';

/**
 * The header for focused flows — booking and authentication. It keeps the brand
 * and one way out, and nothing else that could pull someone off the task.
 */
export function CompactHeader({
  exitHref = '/tutors',
  exitLabel = 'Close and return to search',
}: {
  exitHref?: string;
  exitLabel?: string;
}) {
  return (
    <header className="border-line bg-surface border-b">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <Link
          href={exitHref}
          className="text-ink-subtle hover:bg-surface-sunken hover:text-ink flex size-11 items-center justify-center rounded-[var(--radius-control)]"
        >
          <X className="size-5" aria-hidden />
          <span className="sr-only">{exitLabel}</span>
        </Link>
      </div>
    </header>
  );
}
