'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reveals its children once they scroll into view.
 *
 * The ordering here is the whole trick, and it is the opposite of how these are
 * usually written. The element is authored **visible**; it is only hidden once
 * this component has mounted and confirmed it can observe intersections. The
 * usual arrangement starts at opacity 0 and animates up, which means a page
 * whose JavaScript failed, or whose observer never fired, leaves its content
 * permanently invisible — a marketing page that renders blank for the visitor
 * with the worst connection.
 *
 * There is no animation library behind this. Every effect in the product moves
 * transform and opacity only, which CSS does on the compositor for free; a
 * library would add bundle weight and, worse, would turn every server-rendered
 * section that wanted a fade into a client component.
 */
export function Reveal({
  children,
  index = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  /** Stagger position. Each step delays the animation by 60ms. */
  index?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<'ready' | 'pending' | 'shown'>('ready');

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // No observer, or a user who asked for less motion: stay visible, do
    // nothing. The reduced-motion stylesheet also neutralises the pending
    // state, so this is belt and braces rather than the only guard.
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    // Already on screen at mount — animating it would be a flash, not a reveal.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) {
      setState('shown');
      return;
    }

    setState('pending');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState('shown');
            observer.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={cn(className)}
      data-reveal={state === 'ready' ? undefined : state}
      style={{ '--reveal-index': index } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
}
