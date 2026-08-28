'use client';

import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/lib/use-focus-trap';
import { cn } from '@/lib/utils';

const EASE = [0.22, 1, 0.36, 1] as const;

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hidden titles still need to exist for `aria-labelledby`. */
  hideTitle?: boolean;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function Scrim({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#0b1120]/45 backdrop-blur-[2px]"
      aria-hidden
    />
  );
}

/** Centred dialog. Use for confirmations and short forms. */
export function Modal({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  footer,
  className,
}: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <Scrim onClose={onClose} />
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.24, ease: EASE }}
              className={cn(
                'border-line bg-surface relative flex max-h-[88dvh] w-full flex-col rounded-t-[var(--radius-panel)] border shadow-[var(--shadow-raised)] sm:max-w-lg sm:rounded-[var(--radius-panel)]',
                className,
              )}
            >
              <div className="border-line flex items-start justify-between gap-4 border-b px-5 py-4">
                <div className={cn(hideTitle && 'sr-only')}>
                  <h2 className="text-base font-semibold">{title}</h2>
                  {description && (
                    <p className="text-ink-subtle mt-1 text-sm">{description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-ink-subtle hover:bg-surface-sunken hover:text-ink -m-2 shrink-0 rounded-[var(--radius-control)] p-2"
                >
                  <X className="size-5" aria-hidden />
                  <span className="sr-only">Close</span>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
              {footer && (
                <div className="border-line bg-surface-subtle rounded-b-[var(--radius-panel)] border-t px-5 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Full-height panel anchored to an edge. Used for the mobile menu. */
export function Drawer({
  open,
  onClose,
  title,
  hideTitle,
  children,
  footer,
  side = 'right',
  className,
}: OverlayProps & { side?: 'left' | 'right' }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <Scrim onClose={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ x: side === 'right' ? '100%' : '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'right' ? '100%' : '-100%' }}
            transition={{ duration: 0.28, ease: EASE }}
            className={cn(
              'bg-surface fixed inset-y-0 z-50 flex w-[88%] max-w-sm flex-col shadow-[var(--shadow-raised)]',
              side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
              'border-line',
              className,
            )}
          >
            <div className="border-line flex items-center justify-between border-b px-5 py-4">
              <h2 className={cn('text-base font-semibold', hideTitle && 'sr-only')}>
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="text-ink-subtle hover:bg-surface-sunken hover:text-ink -m-2 rounded-[var(--radius-control)] p-2"
              >
                <X className="size-5" aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && (
              <div className="border-line bg-surface-subtle border-t px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/** Rises from the bottom edge. Used for marketplace filters on mobile. */
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: OverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <>
          <Scrim onClose={onClose} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: EASE }}
            className={cn(
              'border-line bg-surface fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[var(--radius-panel)] border-t shadow-[var(--shadow-raised)]',
              className,
            )}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="bg-line-strong h-1 w-10 rounded-full" aria-hidden />
            </div>
            <div className="border-line flex items-start justify-between gap-4 border-b px-5 pt-2 pb-3">
              <div>
                <h2 className="text-base font-semibold">{title}</h2>
                {description && (
                  <p className="text-ink-subtle mt-0.5 text-sm">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-ink-subtle hover:bg-surface-sunken hover:text-ink -m-2 rounded-[var(--radius-control)] p-2"
              >
                <X className="size-5" aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && (
              <div className="border-line bg-surface-subtle border-t px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
