'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SignOutMenuItem } from './account-menu';

/**
 * Navigation below `md`.
 *
 * The header's link row is `hidden md:flex`, which on its own left phone users
 * with no way to reach the dashboard, the wallet or pricing at all. This is
 * that way.
 *
 * It closes on Escape and on an outside pointer press, returning focus to the
 * button, and it is hidden from assistive technology above `md` — where the
 * real navigation is visible — so a screen-reader user never meets the same
 * links twice.
 */

export function MobileNav({
  links,
  signedIn,
}: {
  links: ReadonlyArray<{ href: string; label: string }>;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="border-rule bg-ground-raised text-text hover:border-rule-strong focus-visible:ring-cobalt flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        {/* Two bars rather than three: the icon is decorative, the label is the
            accessible name. */}
        <span aria-hidden="true" className="flex w-4 flex-col gap-[5px]">
          <span className="bg-ground block h-[1.5px] w-full rounded-full" />
          <span className="bg-ground block h-[1.5px] w-full rounded-full" />
        </span>
        <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Site"
          className="border-rule bg-ground-raised absolute right-0 z-50 mt-2 w-56 border p-1.5 shadow-[var(--shadow-lift)]"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="text-text-muted hover:bg-ground-sunken hover:text-text focus-visible:ring-cobalt block rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              {link.label}
            </Link>
          ))}

          {signedIn ? (
            <>
              <div role="none" className="border-rule my-1 border-t" />
              <Link
                href="/account"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-text-muted hover:bg-ground-sunken hover:text-text focus-visible:ring-cobalt block rounded-[var(--radius-control)] px-3 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Account
              </Link>
              <SignOutMenuItem />
            </>
          ) : (
            <>
              <div role="none" className="border-rule my-1 border-t" />
              <Link
                href="/assess"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="text-cobalt hover:bg-ground-sunken focus-visible:ring-cobalt block rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Start report
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
