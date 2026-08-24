import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Severity and status are always rendered as a tinted chip *with a text label*.
 * Colour alone is never the carrier of meaning — that is both an accessibility
 * requirement and the reason these read as restrained rather than as a traffic
 * light.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-sunken text-ink-muted',
        brand: 'border-brand-line bg-brand-subtle text-brand-hover',
        critical:
          'border-[var(--color-severity-critical-line)] bg-[var(--color-severity-critical-bg)] text-[var(--color-severity-critical)]',
        high: 'border-[var(--color-severity-high-line)] bg-[var(--color-severity-high-bg)] text-[var(--color-severity-high)]',
        medium:
          'border-[var(--color-severity-medium-line)] bg-[var(--color-severity-medium-bg)] text-[var(--color-severity-medium)]',
        low: 'border-[var(--color-severity-low-line)] bg-[var(--color-severity-low-bg)] text-[var(--color-severity-low)]',
        /* Confidence and provenance. Distinct from severity, which reads as a
           warning — a high-confidence finding is not an alarm. */
        success:
          'border-[var(--color-score-good-bg)] bg-[var(--color-score-good-bg)] text-[var(--color-score-good)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
