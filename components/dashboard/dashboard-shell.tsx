'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';
import { Logo, LogoMark } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/overlay';
import { NavIcon } from './nav-icon';
import { AccountMenu } from '@/components/layout/account-menu';
import { NotificationMenu } from '@/components/layout/notification-menu';
import { useDemo } from '@/lib/store/demo-store';
import { DASHBOARD_NAV, ROLE_LABELS } from '@/lib/nav';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * One shell for all four dashboards.
 *
 * Desktop keeps a compact persistent sidebar; mobile drops it for a bottom
 * navigation bar with the four things that role does most, and pushes the rest
 * into a drawer. Nothing is a shrunken copy of the desktop layout.
 */
export function DashboardShell({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { account, hydrated, signInAsRole } = useDemo();
  const [moreOpen, setMoreOpen] = useState(false);

  const links = DASHBOARD_NAV[role];
  const primary = links.filter((link) => link.primary);
  const secondary = links.filter((link) => !link.primary);

  const isActive = (href: string) =>
    href === links[0]?.href ? pathname === href : pathname.startsWith(href);

  if (hydrated && account?.role !== role) {
    return <RoleGate role={role} onSelect={() => signInAsRole(role)} />;
  }

  return (
    <div className="bg-canvas min-h-dvh lg:flex">
      {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
      <aside className="border-line bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r lg:flex">
        <div className="border-line flex h-16 items-center border-b px-5">
          <Logo />
        </div>

        <nav
          aria-label={`${ROLE_LABELS[role]} sections`}
          className="flex-1 overflow-y-auto p-3"
        >
          <ul className="space-y-0.5">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center gap-2.5 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors duration-[var(--duration-fast)]',
                      active
                        ? 'bg-brand-subtle text-brand-ink'
                        : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
                    )}
                  >
                    <NavIcon name={link.icon} className="size-[18px] shrink-0" />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-line border-t p-3">
          <Link
            href="/"
            className="text-ink-subtle hover:bg-surface-sunken hover:text-ink flex min-h-10 items-center gap-2.5 rounded-[var(--radius-control)] px-3 text-sm"
          >
            <LogoMark className="size-[18px]" />
            Back to the public site
          </Link>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* ── Top bar ─────────────────────────────────────────────────── */}
        <header className="border-line bg-canvas/90 sticky top-0 z-30 border-b backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <p className="text-ink-subtle hidden text-sm lg:block">
              {ROLE_LABELS[role]} dashboard
            </p>
            <div className="flex items-center gap-1.5">
              <NotificationMenu />
              <AccountMenu />
            </div>
          </div>
        </header>

        <main id="main" className="px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* ── Bottom navigation (mobile) ────────────────────────────────── */}
      <nav
        aria-label={`${ROLE_LABELS[role]} sections`}
        className="border-line bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-5">
          {primary.slice(0, 4).map((link) => {
            const active = isActive(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-medium',
                    active ? 'text-brand' : 'text-ink-subtle',
                  )}
                >
                  <NavIcon name={link.icon} className="size-5" />
                  <span className="truncate">{link.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="text-ink-subtle flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[0.6875rem] font-medium"
            >
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Drawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="More"
        side="right"
      >
        <ul className="space-y-0.5 p-3">
          {secondary.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={() => setMoreOpen(false)}
                className="text-ink hover:bg-surface-sunken flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] px-3 font-medium"
              >
                <NavIcon name={link.icon} className="size-5" />
                {link.label}
              </Link>
            </li>
          ))}
          <li className="border-line mt-2 border-t pt-2">
            <Link
              href="/"
              onClick={() => setMoreOpen(false)}
              className="text-ink-muted hover:bg-surface-sunken flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] px-3"
            >
              <LogoMark className="size-5" />
              Back to the public site
            </Link>
          </li>
        </ul>
      </Drawer>
    </div>
  );
}

/**
 * Shown when the selected demo account does not match the dashboard being
 * viewed. It is the demo's stand-in for an authorisation check.
 */
function RoleGate({ role, onSelect }: { role: Role; onSelect: () => void }) {
  return (
    <div className="container-narrow flex min-h-dvh flex-col items-center justify-center py-16 text-center">
      <LogoMark className="size-10" />
      <h1 className="mt-5 text-2xl tracking-[var(--tracking-tight)]">
        {ROLE_LABELS[role]} area
      </h1>
      <p className="text-ink-muted mt-2 max-w-md leading-relaxed">
        This dashboard belongs to a {ROLE_LABELS[role].toLowerCase()} account. In the live
        product you would be asked to sign in; here you can switch to the demo{' '}
        {ROLE_LABELS[role].toLowerCase()} account instead.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2.5">
        <Button size="lg" onClick={onSelect}>
          Continue as {ROLE_LABELS[role].toLowerCase()}
        </Button>
        <Button variant="secondary" size="lg" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    </div>
  );
}
