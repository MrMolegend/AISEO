'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu as MenuIcon, Search } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';
import { Drawer } from '@/components/ui/overlay';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AccountMenu } from './account-menu';
import { NotificationMenu } from './notification-menu';
import { useDemo } from '@/lib/store/demo-store';
import { DASHBOARD_HOME, PUBLIC_NAV, ROLE_LABELS } from '@/lib/nav';
import { cn } from '@/lib/utils';

/**
 * Sticky, and slightly translucent once the page has moved — enough to separate
 * it from content scrolling underneath without turning into frosted glass.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { account, hydrated } = useDemo();
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    // Deferred to the next frame so a reload part-way down the page still gets
    // the condensed header, without setting state during the effect itself.
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const signedIn = hydrated && account;

  return (
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-[var(--duration-base)]',
        scrolled
          ? 'border-line bg-canvas/85 border-b backdrop-blur-md'
          : 'border-b border-transparent',
      )}
    >
      <div className="container-page flex h-16 items-center justify-between gap-4 lg:h-[4.5rem]">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {PUBLIC_NAV.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-10 items-center rounded-[var(--radius-control)] px-3 text-[0.9375rem] font-medium transition-colors duration-[var(--duration-fast)]',
                        active
                          ? 'text-brand bg-brand-subtle'
                          : 'text-ink-muted hover:text-ink hover:bg-surface-sunken',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <>
              <ButtonLink
                href={DASHBOARD_HOME[account.role]}
                variant="secondary"
                size="sm"
                className="hidden sm:inline-flex"
              >
                Dashboard
              </ButtonLink>
              <NotificationMenu />
              <AccountMenu />
            </>
          ) : (
            <>
              <ButtonLink
                href="/sign-in"
                variant="ghost"
                size="sm"
                className="hidden lg:inline-flex"
              >
                Sign in
              </ButtonLink>
              <ButtonLink href="/tutors" size="sm" className="hidden lg:inline-flex">
                <Search className="size-4" aria-hidden />
                Find a tutor
              </ButtonLink>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="text-ink hover:bg-surface-sunken flex size-11 items-center justify-center rounded-[var(--radius-control)] lg:hidden"
          >
            <MenuIcon className="size-6" aria-hidden />
            <span className="sr-only">Open menu</span>
          </button>
        </div>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" hideTitle>
        <nav aria-label="Mobile" className="px-3 py-3">
          <ul className="space-y-0.5">
            {PUBLIC_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center rounded-[var(--radius-control)] px-3 text-base font-medium',
                      active
                        ? 'text-brand bg-brand-subtle'
                        : 'text-ink hover:bg-surface-sunken',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {signedIn && (
              <li>
                <Link
                  href={DASHBOARD_HOME[account.role]}
                  onClick={closeMenu}
                  className="text-ink hover:bg-surface-sunken flex min-h-12 items-center rounded-[var(--radius-control)] px-3 text-base font-medium"
                >
                  {ROLE_LABELS[account.role]} dashboard
                </Link>
              </li>
            )}
          </ul>
        </nav>
        <div className="border-line mt-1 border-t px-5 py-4">
          <p className="text-ink-subtle mb-2 text-xs font-semibold tracking-wide uppercase">
            Appearance
          </p>
          <ThemeToggle />
        </div>
        <div className="space-y-2 px-5 py-4">
          <ButtonLink href="/tutors" block size="lg" onClick={closeMenu}>
            Find a tutor
          </ButtonLink>
          {!signedIn && (
            <ButtonLink
              href="/sign-in"
              variant="secondary"
              block
              size="lg"
              onClick={closeMenu}
            >
              Sign in
            </ButtonLink>
          )}
        </div>
      </Drawer>
    </header>
  );
}
