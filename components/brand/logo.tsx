import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The mark is an H built from two uprights — two people, or the two pages of an
 * open book — joined by a bar that rises from left to right. The rise is the
 * point: connection plus progress. It is drawn in two flat colours so it stays
 * legible at 16px and can be reproduced anywhere.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={cn('size-8', className)}
      aria-hidden
      focusable="false"
    >
      {/* Fixed hex rather than theme tokens: a logo has to read the same on the
          warm page background, on the navy footer and inside the dark lesson
          room, so the mark deliberately does not follow the theme. */}
      <rect width="24" height="24" rx="7" fill="#14213A" />
      <rect
        width="24"
        height="24"
        rx="7"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.14"
      />
      <rect x="5.5" y="5" width="3.2" height="14" rx="1.6" fill="#FFFFFF" />
      <rect x="15.3" y="5" width="3.2" height="14" rx="1.6" fill="#FFFFFF" />
      <rect
        x="6.4"
        y="12.4"
        width="11.2"
        height="3"
        rx="1.5"
        transform="rotate(-9 6.4 12.4)"
        fill="#7FDCBE"
      />
    </svg>
  );
}

export function Logo({
  className,
  tone = 'default',
  href = '/',
}: {
  className?: string;
  tone?: 'default' | 'inverse';
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-[var(--radius-control)]',
        className,
      )}
    >
      <LogoMark />
      <span
        className={cn(
          'text-[1.0625rem] font-semibold tracking-[-0.02em]',
          tone === 'inverse' ? 'text-white' : 'text-ink',
        )}
      >
        Tutor Hub
      </span>
    </Link>
  );
}
