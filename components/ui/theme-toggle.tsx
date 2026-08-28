'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeChoice } from '@/lib/store/theme';
import { cn } from '@/lib/utils';

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Three-way theme control. `compact` is the icon-only version for the header. */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        'border-line bg-surface-sunken inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border p-0.5',
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(value)}
            title={`${label} theme`}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-[7px] text-sm font-medium transition-colors duration-[var(--duration-fast)]',
              compact ? 'size-8' : 'h-9 flex-1 px-3',
              active
                ? 'bg-surface text-ink shadow-[var(--shadow-card)]'
                : 'text-ink-subtle hover:text-ink',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {!compact && label}
            {compact && <span className="sr-only">{label} theme</span>}
          </button>
        );
      })}
    </div>
  );
}
