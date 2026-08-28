'use client';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Learner } from '@/lib/types';

/** Switches which child the parent screens are showing. */
export function LearnerSwitcher({
  learners,
  value,
  onChange,
  allowAll = false,
}: {
  learners: Learner[];
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Choose a learner"
      className="no-scrollbar flex gap-2 overflow-x-auto"
    >
      {allowAll && (
        <button
          type="button"
          aria-pressed={value === ''}
          onClick={() => onChange('')}
          className={cn(
            'min-h-11 shrink-0 rounded-[var(--radius-control)] border px-4 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
            value === ''
              ? 'border-brand bg-brand-subtle text-brand-ink'
              : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle',
          )}
        >
          Both learners
        </button>
      )}
      {learners.map((learner) => {
        const active = learner.id === value;
        return (
          <button
            key={learner.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(learner.id)}
            className={cn(
              'flex min-h-11 shrink-0 items-center gap-2.5 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
              active
                ? 'border-brand bg-brand-subtle text-brand-ink'
                : 'border-line-strong bg-surface text-ink-muted hover:border-ink-subtle',
            )}
          >
            <Avatar
              firstName={learner.firstName}
              lastName={learner.lastName}
              tone={learner.avatarTone}
              size="xs"
            />
            {learner.firstName}
            <span className="text-ink-subtle font-normal">{learner.yearGroup}</span>
          </button>
        );
      })}
    </div>
  );
}
