import { cn } from '@/lib/utils';

/**
 * A single number with its label and, where it helps, one line of context.
 * No sparklines, no percentage-change badges invented from nothing.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'brand' | 'mint' | 'warning';
  className?: string;
}) {
  const iconTone = {
    default: 'bg-surface-sunken text-ink-muted',
    brand: 'bg-brand-subtle text-brand',
    mint: 'bg-mint text-mint-ink',
    warning: 'bg-warning-bg text-warning',
  }[tone];

  return (
    <div
      className={cn(
        'border-line bg-surface rounded-[var(--radius-card)] border p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-ink-subtle text-sm">{label}</p>
        {icon && (
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-control)]',
              iconTone,
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-ink-subtle mt-1 text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}
