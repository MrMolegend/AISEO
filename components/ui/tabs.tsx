'use client';

import { useId, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

/**
 * A proper ARIA tablist: arrow keys move between tabs, the active panel is
 * associated with its tab, and the underline is a shared layout animation
 * rather than a transitioning border.
 */
export function Tabs({
  items,
  value,
  onChange,
  className,
  size = 'md',
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const groupId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent) {
    const index = items.findIndex((item) => item.id === value);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % items.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;

    event.preventDefault();
    const target = items[next];
    if (!target) return;
    onChange(target.id);
    listRef.current
      ?.querySelector<HTMLButtonElement>(`#${CSS.escape(`${groupId}-${target.id}`)}`)
      ?.focus();
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'border-line no-scrollbar flex gap-1 overflow-x-auto border-b',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            id={`${groupId}-${item.id}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={`${groupId}-${item.id}-panel`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex shrink-0 items-center gap-2 px-3 font-medium transition-colors duration-[var(--duration-fast)]',
              size === 'sm' ? 'h-10 text-sm' : 'h-12 text-[0.9375rem]',
              active ? 'text-ink' : 'text-ink-subtle hover:text-ink',
            )}
          >
            {item.icon}
            {item.label}
            {active && (
              <motion.span
                layoutId={`${groupId}-indicator`}
                className="bg-brand absolute inset-x-1 -bottom-px h-0.5 rounded-full"
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The panel half of `Tabs`. Cross-fades on change; no layout jump. */
export function TabPanel({
  id,
  active,
  children,
  className,
}: {
  id: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {active && (
        <motion.div
          key={id}
          role="tabpanel"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A compact two-to-four option switch — list/grid view, upcoming/past. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'border-line bg-surface-sunken inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-9 items-center gap-1.5 rounded-[7px] px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
              active
                ? 'bg-surface text-ink shadow-[var(--shadow-card)]'
                : 'text-ink-subtle hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
