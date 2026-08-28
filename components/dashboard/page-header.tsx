import { cn } from '@/lib/utils';

/** The heading block every dashboard screen starts with. */
export function PageHeader({
  title,
  lead,
  action,
  className,
}: {
  title: string;
  lead?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-6 gap-y-3',
        className,
      )}
    >
      <div className="max-w-2xl">
        <h1 className="text-2xl tracking-[var(--tracking-tight)]">{title}</h1>
        {lead && <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">{lead}</p>}
      </div>
      {action}
    </div>
  );
}
