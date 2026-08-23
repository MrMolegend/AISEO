import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-soft)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-ink-inverse hover:bg-brand-hover shadow-[var(--shadow-card)]',
        secondary:
          'bg-surface text-ink border border-line-strong hover:bg-surface-subtle',
        ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 rounded-[var(--radius-control)] px-3.5 text-sm',
        md: 'h-11 rounded-[var(--radius-control)] px-5 text-[15px]',
        lg: 'h-14 rounded-[var(--radius-control)] px-7 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
