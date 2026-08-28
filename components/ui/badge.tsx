import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * A small status label. Deliberately square-ish — the site avoids pill shapes
 * except where a chip is genuinely removable.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-sunken text-ink-muted',
        brand: 'border-brand-line bg-brand-subtle text-brand-ink',
        mint: 'border-mint-line bg-mint text-mint-ink',
        success: 'border-success-line bg-success-bg text-success',
        warning: 'border-warning-line bg-warning-bg text-warning',
        danger: 'border-danger-line bg-danger-bg text-danger',
        info: 'border-info-line bg-info-bg text-info',
        outline: 'border-line-strong bg-transparent text-ink-muted',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
