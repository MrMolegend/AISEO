import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';

/**
 * The wordmark.
 *
 * Drawn from config/brand.ts rather than an image file, so renaming the product
 * is a one-line change rather than an asset hunt. The monogram is a rounded
 * square with two letters — deliberately plain, because a working title dressed
 * up as a finished identity is harder to replace later.
 */
export function Logo({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className="bg-brand text-ink-inverse inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-[13px] font-semibold tracking-tight tabular-nums"
      >
        {BRAND.monogram}
      </span>
      {showName && (
        <span className="text-ink text-[15px] font-semibold tracking-[-0.01em]">
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
