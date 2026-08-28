import { cn } from '@/lib/utils';
import { ButtonLink } from './button';

/** A screen with nothing in it should still tell you what to do next. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-line bg-surface flex flex-col items-center rounded-[var(--radius-card)] border border-dashed px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="bg-brand-subtle text-brand mb-4 flex size-12 items-center justify-center rounded-[var(--radius-card)]">
          {icon}
        </span>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="text-ink-subtle mt-1.5 max-w-sm text-sm leading-relaxed">{body}</p>
      {action && (
        <ButtonLink href={action.href} variant="secondary" className="mt-5">
          {action.label}
        </ButtonLink>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-surface-sunken animate-pulse rounded-[var(--radius-control)]',
        className,
      )}
      aria-hidden
    />
  );
}

/** The marketplace's loading shape, reused by its Suspense fallback. */
export function TutorCardSkeleton() {
  return (
    <div className="border-line bg-surface space-y-4 rounded-[var(--radius-card)] border p-5">
      <div className="flex gap-4">
        <Skeleton className="size-14 rounded-[var(--radius-card)]" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
