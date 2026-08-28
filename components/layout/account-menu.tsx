'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BRAND } from '@/config/brand';
import { formatTokens } from '@/config/tokens';

/**
 * The signed-in control.
 *
 * Carries the account's identity and its balance, so that on any page — and at
 * any width — there is one obvious place that answers "am I signed in, as whom,
 * and with how many tokens". Previously the balance lived in a chip that
 * disappeared below `sm` and the navigation disappeared below `md`, which left
 * a phone user with a logo and an unlabelled circle.
 *
 * Sign-out is a form posting to /auth/sign-out rather than a click handler. It
 * works before hydration, it cannot be triggered by a stray GET, and the
 * session is revoked at Supabase rather than merely forgotten by this browser.
 */

export function AccountMenu({
  email,
  balance,
}: {
  email: string | null;
  balance: { available: number; reserved: number } | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // Focus goes back where it came from, or it lands at the top of the page.
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

  const initial = (email ?? '?').slice(0, 1).toUpperCase();

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="border-rule bg-ground-raised text-text hover:border-rule-strong focus-visible:ring-cobalt flex h-9 items-center gap-2 rounded-full border pr-3 pl-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span
          aria-hidden="true"
          className="bg-signal text-text-on-signal flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold"
        >
          {initial}
        </span>
        {/* The balance sits in the trigger so it survives to the narrowest
            viewport, where a separate chip would have been hidden. */}
        {balance && (
          <span className="text-[13px] font-medium tabular-nums">
            {formatTokens(balance.available)}
          </span>
        )}
        <span className="sr-only">
          Account menu
          {email ? ` for ${email}` : ''}
          {balance
            ? `. ${formatTokens(balance.available)} ${BRAND.currency.plural} available`
            : ''}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="border-rule bg-ground-raised absolute right-0 z-50 mt-2 w-64 rounded-[var(--radius-panel)] border p-1.5 shadow-[var(--shadow-lift)]"
        >
          <div className="px-3 py-2.5">
            <p className="text-text truncate text-sm font-medium">
              {email ?? 'Signed in'}
            </p>
            {balance && (
              <p className="text-text-subtle mt-0.5 text-xs tabular-nums">
                {formatTokens(balance.available)} {BRAND.currency.plural}
                {balance.reserved > 0 && ` · ${formatTokens(balance.reserved)} held`}
              </p>
            )}
          </div>

          <div role="none" className="border-rule my-1 border-t" />

          <MenuLink href="/dashboard" onNavigate={() => setOpen(false)}>
            Dashboard
          </MenuLink>
          <MenuLink href="/dashboard#reports" onNavigate={() => setOpen(false)}>
            My reports
          </MenuLink>
          <MenuLink href="/wallet" onNavigate={() => setOpen(false)}>
            {BRAND.currency.name}
          </MenuLink>
          <MenuLink href="/account" onNavigate={() => setOpen(false)}>
            Account
          </MenuLink>

          <div role="none" className="border-rule my-1 border-t" />

          <SignOutMenuItem />
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="text-text-muted hover:bg-ground-sunken hover:text-text focus-visible:ring-cobalt block rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}

/** A real form, so signing out does not depend on JavaScript having loaded. */
export function SignOutMenuItem() {
  return (
    <form action="/auth/sign-out" method="post">
      <button
        type="submit"
        role="menuitem"
        className="text-text-muted hover:bg-ground-sunken hover:text-text focus-visible:ring-cobalt block w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        Sign out
      </button>
    </form>
  );
}
