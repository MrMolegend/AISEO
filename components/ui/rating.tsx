import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The star row is decorative — the accessible name carries the number, because
 * counting five icons is not how anyone wants to hear a rating read out.
 */
export function Rating({
  value,
  count,
  size = 'md',
  showCount = true,
  className,
}: {
  value: number;
  count?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}) {
  const starSize = size === 'sm' ? 'size-3.5' : size === 'lg' ? 'size-5' : 'size-4';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              starSize,
              star <= Math.round(value)
                ? 'fill-warning text-warning'
                : 'text-line-strong',
            )}
          />
        ))}
      </span>
      <span className={cn('text-ink tabular font-medium', textSize)}>
        {value.toFixed(1)}
      </span>
      {showCount && count !== undefined && (
        <span className={cn('text-ink-subtle tabular', textSize)}>({count})</span>
      )}
      <span className="sr-only">
        Rated {value.toFixed(1)} out of 5
        {count !== undefined ? ` from ${count} reviews` : ''}
      </span>
    </span>
  );
}
