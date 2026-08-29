'use client';
import { useEffect, useState } from 'react';
import { REPORT_SECTIONS } from '@/schemas/market-entry/report';
import { cn } from '@/lib/utils';

/**
 * The contents navigation, in two forms.
 *
 * On a wide screen it is a sticky rail that tracks which section is being read.
 * On a phone it is a horizontally scrolling rail pinned under the header,
 * because a twelve-item vertical list would occupy the screen the report is
 * supposed to be on.
 *
 * The tracking uses one IntersectionObserver over all twelve headings rather
 * than a scroll handler doing twelve rect reads per frame. `rootMargin` biases
 * the detection band toward the top of the viewport, so the highlighted section
 * is the one being read rather than the one about to leave.
 */
export function ContentsNav() {
  const [active, setActive] = useState<string>(REPORT_SECTIONS[0].id);

  useEffect(() => {
    const sections = REPORT_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((element): element is HTMLElement => element !== null);

    if (sections.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );

    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label="Report contents"
        className="hidden xl:sticky xl:top-24 xl:block xl:self-start print:hidden"
      >
        <p className="meta text-text-faint mb-3">Contents</p>
        <ol className="space-y-0.5">
          {REPORT_SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? 'true' : undefined}
                className={cn(
                  'flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3 text-[13px] transition-colors',
                  active === section.id
                    ? 'border-signal text-text'
                    : 'text-text-muted hover:text-text border-transparent',
                )}
              >
                <span className="meta text-text-faint">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {section.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Mobile rail. Sticky under the header, and horizontally scrollable —
          with a visible edge rule rather than a hidden scrollbar, so the
          affordance survives. */}
      <nav
        aria-label="Report contents"
        className="border-rule bg-ground sticky top-[3.5rem] z-[20] -mx-5 border-b px-5 py-2 xl:hidden print:hidden"
      >
        <ul className="scroll-rail flex gap-1">
          {REPORT_SECTIONS.map((section) => (
            <li key={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={active === section.id ? 'true' : undefined}
                className={cn(
                  'block border px-2.5 py-1.5 text-[12px] whitespace-nowrap transition-colors',
                  active === section.id
                    ? 'border-signal text-signal'
                    : 'border-rule text-text-muted',
                )}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
