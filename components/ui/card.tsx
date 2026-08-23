import { cn } from '@/lib/utils';

/**
 * One hairline border plus one soft shadow. Two elevation levels exist in the
 * whole product; `raised` is the second and is used sparingly.
 */
export function Card({
  className,
  raised = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return (
    <div
      className={cn(
        'border-line bg-surface rounded-[var(--radius-card)] border',
        raised ? 'shadow-[var(--shadow-raised)]' : 'shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 md:p-6', className)} {...props} />;
}
