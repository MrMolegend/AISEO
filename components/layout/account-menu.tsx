'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAuthClient } from '@/lib/auth/client';

/**
 * Account menu.
 *
 * Hand-rolled rather than pulled from a component library, because the
 * behaviour needed here is small and specific: Escape closes it, a click
 * outside closes it, focus returns to the trigger, and the trigger describes
 * its own state. A dropdown that traps keyboard users is worse than no
 * dropdown.
 */
export function AccountMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  async function signOut() {
    try {
      await createAuthClient().auth.signOut();
    } catch {
      // Already signed out, or auth is not configured. Either way the next
      // server render will show the signed-out header.
    }
    router.push('/');
    router.refresh();
  }

  const initial = (email ?? '?').slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="border-line bg-surface-subtle text-ink hover:border-line-strong focus-visible:ring-brand flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span aria-hidden="true">{initial}</span>
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="border-line bg-surface absolute right-0 mt-2 w-64 rounded-[var(--radius-card)] border p-1.5 shadow-[var(--shadow-raised)]"
        >
          <p className="text-ink-subtle truncate px-3 py-2 text-xs" title={email ?? ''}>
            {email ?? 'Signed in'}
          </p>
          <div className="bg-line my-1 h-px" role="none" />
          <MenuLink href="/dashboard" onNavigate={() => setOpen(false)}>
            Dashboard
          </MenuLink>
          <MenuLink href="/wallet" onNavigate={() => setOpen(false)}>
            Wallet
          </MenuLink>
          <MenuLink href="/account" onNavigate={() => setOpen(false)}>
            Account
          </MenuLink>
          <div className="bg-line my-1 h-px" role="none" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:ring-brand w-full rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Sign out
          </button>
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
      className="text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:ring-brand block rounded-[var(--radius-control)] px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
