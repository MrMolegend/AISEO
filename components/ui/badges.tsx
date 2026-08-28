import { BadgeCheck, Clock } from 'lucide-react';
import { Badge } from './badge';
import { formatRelativeDay, formatTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';

/**
 * "Verified" means Tutor Hub has reviewed this tutor's application and checked
 * their identity and qualification documents — see `/about`. It is never a
 * claim about a statutory certification.
 */
export function VerifiedBadge({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <Badge tone="brand" className={cn('gap-1', className)}>
      <BadgeCheck className="size-3.5" aria-hidden />
      {compact ? <span className="sr-only">Verified tutor</span> : 'Verified'}
    </Badge>
  );
}

export function SubjectBadge({
  name,
  tone = 'neutral',
  className,
}: {
  name: string;
  tone?: 'neutral' | 'mint' | 'brand';
  className?: string;
}) {
  return (
    <Badge tone={tone} className={className}>
      {name}
    </Badge>
  );
}

/** Next free slot, phrased the way a person would say it. */
export function AvailabilityIndicator({
  nextAvailable,
  className,
}: {
  nextAvailable: string;
  className?: string;
}) {
  return (
    <span
      className={cn('text-mint-ink inline-flex items-center gap-1.5 text-sm', className)}
    >
      <Clock className="size-3.5 shrink-0" aria-hidden />
      <span>
        Next free {formatRelativeDay(nextAvailable).toLowerCase()} at{' '}
        <span className="tabular font-medium">{formatTime(nextAvailable)}</span>
      </span>
    </span>
  );
}
