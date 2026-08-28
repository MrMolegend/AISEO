'use client';

import { Heart } from 'lucide-react';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { cn } from '@/lib/utils';

/**
 * Saves to localStorage through the demo store, so a favourite survives a
 * refresh. Until the store has hydrated the heart renders empty, which matches
 * what the server sent and avoids a hydration warning.
 */
export function FavouriteButton({
  tutorId,
  tutorName,
  size = 'md',
  withLabel = false,
  className,
}: {
  tutorId: string;
  tutorName: string;
  size?: 'sm' | 'md';
  withLabel?: boolean;
  className?: string;
}) {
  const { isFavourite, toggleFavourite, hydrated } = useDemo();
  const { toast } = useToast();
  const saved = hydrated && isFavourite(tutorId);

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const added = toggleFavourite(tutorId);
        toast({
          title: added ? `${tutorName} saved` : `${tutorName} removed`,
          description: added
            ? 'Find them again under Saved tutors.'
            : 'No longer in your saved list.',
          tone: added ? 'success' : 'info',
        });
      }}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border transition-colors duration-[var(--duration-fast)] active:translate-y-px',
        withLabel
          ? 'h-11 px-4 text-sm font-medium'
          : size === 'sm'
            ? 'size-9'
            : 'size-11',
        saved
          ? 'border-danger-line bg-danger-bg text-danger'
          : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle hover:text-ink',
        className,
      )}
    >
      <Heart className={cn('size-[18px]', saved && 'fill-current')} aria-hidden />
      {withLabel && (saved ? 'Saved' : 'Save')}
      <span className="sr-only">
        {saved ? `Remove ${tutorName} from saved tutors` : `Save ${tutorName}`}
      </span>
    </button>
  );
}
