'use client';
import { useEffect, useState } from 'react';

/**
 * The header, which condenses once the page has moved.
 *
 * Three things change and no more: the height, the border, and whether there is
 * a ground behind it. At the top of a page the header is part of the
 * composition and has no visible edge; once content is passing underneath it
 * becomes a rule with a surface behind it, which is what makes text remain
 * readable as it scrolls past.
 *
 * No blur. A backdrop-filter on a sticky element repaints a full-width strip on
 * every scroll frame, which is the single most reliable way to make a page feel
 * cheap on a mid-range phone — and it is the effect the brief rules out.
 *
 * The listener is passive and the state is a boolean, so a scroll only causes a
 * render on the two frames where it actually crosses the threshold.
 */
export function ScrollShrink({ children }: { children: React.ReactNode }) {
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = () => setCondensed(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      data-condensed={condensed ? '' : undefined}
      /* Not printed. A navigation bar on paper is an inch of chrome at the top
         of a document someone is carrying into a meeting. */
      className="sticky top-0 z-[30] border-b border-transparent transition-[background-color,border-color] duration-[var(--duration-base)] ease-[var(--ease-out-soft)] data-condensed:border-[var(--color-rule)] data-condensed:bg-[var(--color-ground)] print:hidden"
      style={
        {
          '--header-height': condensed ? '3.5rem' : '4.5rem',
        } as React.CSSProperties
      }
    >
      {children}
    </header>
  );
}
