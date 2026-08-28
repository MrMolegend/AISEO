import { cn } from '@/lib/utils';

/**
 * A labelled bar. The value is always written out next to it, so the fill is
 * reinforcement rather than the only way to read the number.
 */
export function ProgressBar({
  value,
  label,
  tone = 'brand',
  className,
}: {
  value: number;
  label: string;
  tone?: 'brand' | 'mint' | 'warning';
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const fill =
    tone === 'mint' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-brand';

  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="bg-surface-sunken h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-[var(--duration-slow)]',
            fill,
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
