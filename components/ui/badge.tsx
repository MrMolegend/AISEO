import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * A status chip.
 *
 * Every one of these is rendered with its meaning as text. Colour is a second
 * signal for someone scanning a page, never the carrier of the meaning — which
 * is both an accessibility requirement and the reason a report full of these
 * reads as restrained rather than as a traffic light.
 *
 * Square-cornered, hairline-bounded, uppercase mono. It looks like a label
 * stamped on a document rather than a pill from a component library, and that
 * is the entire intent.
 */
const badgeVariants = cva(
  'meta inline-flex items-center gap-1.5 border whitespace-nowrap rounded-[var(--radius-hair)]',
  {
    variants: {
      tone: {
        neutral: 'border-rule bg-ground-sunken text-text-subtle',
        signal: 'border-signal/40 bg-signal-surface text-signal',
        cobalt: 'border-cobalt-line bg-cobalt-surface text-cobalt',
        copper: 'border-copper-line bg-copper-surface text-copper',
        /** Evidence grades and verdicts pass their own token through `style`. */
        token: 'bg-transparent',

        /*
         * Legacy tones.
         *
         * The reports produced by the previous product are still readable at
         * their original URLs, and the components that render them still ask
         * for these names. Rather than fork the badge — or, worse, leave those
         * pages calling a variant that no longer exists — the old names are
         * mapped onto the new palette. A legacy report therefore renders in the
         * current design system rather than in a preserved copy of the old one,
         * which is the version of "still readable" worth having.
         */
        brand: 'border-cobalt-line bg-cobalt-surface text-cobalt',
        success: 'border-rule bg-ground-sunken text-verdict-promising',
        critical: 'border-copper-line bg-copper-surface text-copper',
        high: 'border-copper-line bg-copper-surface text-copper',
        medium: 'border-cobalt-line bg-cobalt-surface text-cobalt',
        low: 'border-rule bg-ground-sunken text-text-subtle',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px]',
        md: 'px-2 py-1 text-[11px]',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** A `--color-*` token name. Only meaningful with `tone="token"`. */
  token?: string;
}

export function Badge({ className, tone, size, token, style, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ tone, size }), className)}
      style={
        token
          ? {
              color: `var(--color-${token})`,
              borderColor: `color-mix(in oklab, var(--color-${token}) 45%, transparent)`,
              ...style,
            }
          : style
      }
      {...props}
    />
  );
}
