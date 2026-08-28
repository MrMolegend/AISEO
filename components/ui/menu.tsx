'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';

/**
 * A dropdown that closes on Escape, on an outside click, and whenever focus
 * leaves it. The panel sits after the trigger in the DOM, so normal tab order
 * already does the right thing and no roving tabindex is needed.
 */
export function Menu({
  trigger,
  children,
  align = 'end',
  panelClassName,
  label,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
  panelClassName?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    }
    function onFocusIn(event: FocusEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            role="menu"
            aria-label={label}
            className={cn(
              'border-line bg-surface absolute top-[calc(100%+0.5rem)] z-50 w-64 origin-top overflow-hidden rounded-[var(--radius-card)] border shadow-[var(--shadow-raised)]',
              align === 'end' ? 'right-0' : 'left-0',
              panelClassName,
            )}
          >
            {children(() => setOpen(false))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MenuItem({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'text-ink hover:bg-surface-sunken flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm transition-colors duration-[var(--duration-fast)]',
        className,
      )}
      {...props}
    />
  );
}

export function MenuSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-line border-t py-1 first:border-t-0">
      <p className="text-ink-subtle px-3.5 pt-1.5 pb-1 text-[0.6875rem] font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
