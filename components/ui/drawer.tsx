import { cn } from '@/lib/utils';

/**
 * An expandable panel, built on `<details>`.
 *
 * Native disclosure rather than a hand-rolled one, and the reason is worth
 * stating: `<details>` is keyboard-operable, announced correctly as expanded or
 * collapsed, findable by in-page search even while closed in modern browsers,
 * and works with no JavaScript at all. Every hand-built version of this control
 * reimplements three of those and forgets the fourth.
 *
 * The transition moves opacity and transform on the *contents*, not the height
 * of the container. Animating height would animate layout on every frame; this
 * way the box snaps to its size and the evidence inside slides in, which reads
 * as the same gesture and costs nothing.
 */
export function Drawer({
  summary,
  children,
  className,
  contentClassName,
  defaultOpen = false,
}: {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cn('group border-rule border-t', className)} open={defaultOpen}>
      <summary
        className={cn(
          'text-text-muted hover:text-text flex cursor-pointer list-none items-center gap-2.5 py-3 text-[13px] transition-colors',
          // Safari still paints its own marker without this.
          '[&::-webkit-details-marker]:hidden',
        )}
      >
        <span
          aria-hidden="true"
          className="text-text-faint inline-block transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] group-open:rotate-90"
        >
          ›
        </span>
        {summary}
      </summary>

      <div
        className={cn(
          'origin-top pb-4 opacity-0 transition-[opacity,transform] duration-[var(--duration-base)] ease-[var(--ease-out-soft)]',
          '-translate-y-1 group-open:translate-y-0 group-open:opacity-100',
          contentClassName,
        )}
      >
        {children}
      </div>
    </details>
  );
}
