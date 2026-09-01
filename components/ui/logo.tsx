import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';

/**
 * The mark.
 *
 * Two concentric brackets with a route line running between them — an origin
 * market, a target market, and the corridor between the two. Drawn in SVG from
 * currentColor rather than shipped as an asset, so it inherits whatever surface
 * it lands on and a rebrand touches one file.
 *
 * The wordmark is set in the display face at a tight tracking, because the
 * product name is short enough to be a mark in its own right and a monogram
 * badge beside it would be one graphic too many.
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
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 shrink-0"
      >
        {/* Origin bracket */}
        <path
          d="M6 4 H3 V20 H6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        {/* Target bracket */}
        <path
          d="M18 4 H21 V20 H18"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        {/* The corridor */}
        <path
          d="M7.5 12 H16.5"
          stroke="var(--color-signal)"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
        <circle cx="16.5" cy="12" r="2" fill="var(--color-signal)" />
      </svg>
      {showName && (
        <span className="font-display text-[17px] font-semibold tracking-[-0.02em]">
          {BRAND.name}
        </span>
      )}
    </span>
  );
}
