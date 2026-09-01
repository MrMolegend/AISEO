import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Slot } from './slot';

/**
 * Buttons, and the links that have to look like them.
 *
 * `asChild` is the reason this file changed shape. A design system where the
 * primary action is a `<button>` component and half the primary actions are
 * links is a design system that gets copied by hand, which is exactly what had
 * happened. Now `<Button asChild><Link …/></Button>` produces an anchor with
 * the button's appearance and the anchor's semantics, and there is one
 * definition of what a primary action looks like.
 *
 * The variants are deliberately few. `primary` is signal-filled and there is
 * only ever one on a screen; `secondary` is a hairline box; `ghost` is for
 * dense toolbars; `link` is inline text. Nothing here has a gradient, a glow or
 * a rounded pill — the square edge is load-bearing for how the product reads.
 */
const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium',
    'transition-[background-color,border-color,color,transform] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)]',
    // A press that moves is a press that felt like it happened.
    'active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-signal text-text-on-signal hover:bg-signal-dim',
        secondary:
          'border border-rule-strong bg-transparent text-text hover:border-signal hover:text-signal',
        ghost: 'text-text-muted hover:bg-ground-raised hover:text-text',
        link: 'text-cobalt underline-offset-4 hover:underline',
        danger:
          'border border-copper-line bg-copper-surface text-copper hover:border-copper',
      },
      size: {
        sm: 'h-9 rounded-[var(--radius-control)] px-3.5 text-[13px]',
        md: 'h-11 rounded-[var(--radius-control)] px-5 text-[14px]',
        lg: 'h-14 rounded-[var(--radius-control)] px-7 text-[15px]',
        /** Square, for icon-only controls. Always needs an accessible name. */
        icon: 'h-11 w-11 rounded-[var(--radius-control)]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element with these styles instead of a <button>. */
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return <Slot className={classes}>{props.children}</Slot>;
  }
  return <button className={classes} {...props} />;
}

export { buttonVariants };
