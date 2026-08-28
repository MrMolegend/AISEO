import { cn } from '@/lib/utils';

/**
 * A bordered surface. Elevation is opt-in: most cards separate with a border
 * and a background step, and only things that genuinely float get a shadow.
 */
export function Card({
  className,
  as: Component = 'div',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { as?: React.ElementType }) {
  return (
    <Component
      className={cn(
        'border-line bg-surface rounded-[var(--radius-card)] border',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-line flex items-center justify-between gap-3 border-b px-5 py-4',
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  as: Component = 'h2',
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: React.ElementType }) {
  return <Component className={cn('text-base font-semibold', className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}
