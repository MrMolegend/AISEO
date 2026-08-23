'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ReportSection {
  id: string;
  label: string;
}

/**
 * Section navigation with scrollspy.
 *
 * Desktop (xl and up) is a sticky sidebar; below that it collapses to a sticky
 * rail of horizontally-scrollable pills. The active pill is scrolled into view
 * on mobile, because a scrollspy the user cannot see is worse than none.
 */
export function ReportNav({ sections }: { sections: ReportSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Choose the entry nearest the top of the reading area rather than the
        // first intersecting one, which flickers between adjacent sections.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // Top offset clears the sticky header; the tall bottom margin means the
      // last section can still win even when it cannot fill the viewport.
      { rootMargin: '-96px 0px -55% 0px', threshold: 0 },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const pill = rail.querySelector<HTMLElement>(`[data-nav-id="${active}"]`);
    pill?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [active]);

  return (
    <>
      {/* Desktop sidebar */}
      <nav aria-label="Report sections" className="hidden xl:block">
        <ul className="sticky top-24 space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? 'true' : undefined}
                className={cn(
                  'block rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors',
                  active === section.id
                    ? 'bg-brand-subtle text-brand-hover font-medium'
                    : 'text-ink-subtle hover:text-ink hover:bg-surface-sunken',
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Tablet and mobile rail */}
      <nav
        aria-label="Report sections"
        className="border-line bg-canvas/90 sticky top-16 z-40 -mx-5 border-b backdrop-blur-md md:-mx-8 xl:hidden"
      >
        <div ref={railRef} className="scroll-rail flex gap-1.5 px-5 py-2.5 md:px-8">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              data-nav-id={section.id}
              aria-current={active === section.id ? 'true' : undefined}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                active === section.id
                  ? 'bg-brand text-ink-inverse'
                  : 'bg-surface-sunken text-ink-muted hover:text-ink',
              )}
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
