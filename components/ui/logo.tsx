import { cn } from '@/lib/utils';

/**
 * A rising bar mark. Deliberately abstract: the product is about measurement and
 * improvement, and anything more literal (magnifying glass, robot) would date
 * badly and read as a template.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <rect width="28" height="28" rx="7" className="fill-brand" />
      <rect
        x="7"
        y="15"
        width="3.5"
        height="6"
        rx="1.2"
        fill="white"
        fillOpacity="0.55"
      />
      <rect
        x="12.25"
        y="11"
        width="3.5"
        height="10"
        rx="1.2"
        fill="white"
        fillOpacity="0.78"
      />
      <rect x="17.5" y="7" width="3.5" height="14" rx="1.2" fill="white" />
    </svg>
  );
}
