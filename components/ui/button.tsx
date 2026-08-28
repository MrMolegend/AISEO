import { cva, type VariantProps } from 'class-variance-authority';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Buttons are substantial rather than pill-shaped, and move 1px on press so a
 * tap feels acknowledged without anything bouncing. Every size clears the 44px
 * touch target except `sm`, which is only used inside dense desktop toolbars.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-[background-color,color,border-color,transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] active:translate-y-px disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-on-brand hover:bg-brand-hover shadow-[var(--shadow-card)]',
        navy: 'bg-navy text-white hover:bg-navy-soft dark:bg-brand dark:text-on-brand dark:hover:bg-brand-hover',
        secondary:
          'bg-surface text-ink border border-line-strong hover:border-ink-subtle hover:bg-surface-subtle',
        subtle: 'bg-brand-subtle text-brand-ink hover:bg-brand-line/60',
        ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        danger: 'bg-danger text-white dark:text-ink-inverse hover:brightness-95',
        link: 'text-brand h-auto p-0 underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-[0.9375rem]',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-7 text-base',
        icon: 'size-11',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

type ButtonBaseProps = VariantProps<typeof buttonVariants> & { className?: string };

export type ButtonProps = ButtonBaseProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export type ButtonLinkProps = ButtonBaseProps & React.ComponentProps<typeof Link>;

/** The same surface as `Button`, for navigation. Never renders a bare anchor. */
export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
