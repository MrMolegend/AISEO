import { cn } from '@/lib/utils';

/**
 * The legacy card.
 *
 * Kept only because the components that render reports from the previous
 * product still use it, and those reports remain readable at their original
 * URLs. Restyled onto the current tokens so a legacy report looks like it
 * belongs to this application rather than like a preserved fossil of the last
 * one — but with the radius and the shadow taken out, because the rounded-card
 * grid is precisely what the new design is not.
 *
 * Nothing new should use this. Use Panel.
 */
export function Card({
  className,
  raised = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { raised?: boolean }) {
  return (
    <div
      className={cn(
        'border-rule bg-ground-raised border',
        raised && 'border-rule-strong',
        className,
      )}
      {...props}
    />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 md:p-6', className)} {...props} />;
}
