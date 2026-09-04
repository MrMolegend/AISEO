import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { getCurrentUser } from '@/lib/auth/server';
import { getMembership } from '@/lib/auth/membership';
import { BRAND } from '@/config/brand';
import { ROLE_LABEL } from '@/schemas/team';
import { Suspense } from 'react';
import { AccountMenu } from './account-menu';
import { MobileNav } from './mobile-nav';
import { ScrollShrink } from './scroll-shrink';
import { CommandPalette } from './command-palette';

/**
 * Site header.
 *
 * A Server Component, so the signed-in state is resolved on the server and the
 * page never flashes a signed-out header before correcting itself. Identity
 * comes from a verified JWT; the role comes from the membership table on this
 * request — see lib/auth/membership.ts.
 *
 * Three states, deliberately distinct:
 *   · a member sees the workspace navigation for their role;
 *   · a signed-in non-member sees only the account control — every path
 *     leads to the request-access holding page;
 *   · a signed-out visitor sees the wordmark and Sign in. This is an
 *     internal tool: there is nothing to market.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const membership = user ? await getMembership() : null;

  const role = membership?.member.role ?? null;

  /** The row that must survive at md+: the surfaces used hourly. */
  const primaryLinks = role
    ? [
        { href: '/dashboard', label: 'Command Center' },
        { href: '/leads', label: 'Leads' },
        { href: '/campaigns', label: 'Campaigns' },
        { href: '/pipeline', label: 'Pipeline' },
        { href: '/outreach', label: 'Outreach' },
        { href: '/tasks', label: 'Tasks' },
      ]
    : [];

  /** The rest of the workspace, reached through the menus. */
  const secondaryLinks = role
    ? [
        { href: '/relationships', label: 'Relationships' },
        { href: '/territories', label: 'Territories' },
        { href: '/intelligence', label: 'Intelligence' },
        { href: '/icps', label: 'Ideal customer profiles' },
        ...(role === 'super_admin' || role === 'sales_manager'
          ? [
              { href: '/commercial', label: 'Commercial configuration' },
              { href: '/team', label: 'Team' },
            ]
          : []),
        ...(role === 'super_admin' ? [{ href: '/admin', label: 'Admin' }] : []),
      ]
    : [];

  return (
    <ScrollShrink>
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--container-page)] items-center gap-4 px-5 transition-[height] duration-[var(--duration-base)] ease-[var(--ease-out-soft)] md:px-8">
        <Link
          href={membership ? '/dashboard' : '/'}
          className="text-text rounded-[var(--radius-control)] focus-visible:outline-none"
          aria-label={`${BRAND.name} home`}
        >
          <Logo />
        </Link>

        {primaryLinks.length > 0 && (
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 lg:flex">
            {primaryLinks.map((link) => (
              <HeaderLink key={link.href} href={link.href}>
                {link.label}
              </HeaderLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {membership && (
            <>
              <span
                className="text-text-subtle hidden text-[11px] tracking-wide md:inline"
                aria-hidden="true"
              >
                Ctrl K
              </span>
              <Suspense fallback={null}>
                <CommandPalette />
              </Suspense>
            </>
          )}
          {user ? (
            <AccountMenu
              email={user.email}
              roleLabel={role ? ROLE_LABEL[role] : null}
              workspaceLinks={secondaryLinks}
            />
          ) : (
            <Link
              href="/sign-in"
              className="text-text-muted hover:text-text inline-flex h-9 items-center rounded-[var(--radius-control)] px-3 text-[13px] font-medium transition-colors"
            >
              Sign in
            </Link>
          )}

          {/* Below lg this is the only route to the navigation. It carries the
              complete workspace map, not just the primary row. */}
          {membership && (
            <MobileNav
              links={[...primaryLinks, ...secondaryLinks]}
              signedIn={Boolean(user)}
            />
          )}
        </div>
      </div>
    </ScrollShrink>
  );
}

/**
 * A navigation link whose underline travels rather than appears.
 *
 * The transform runs on a pseudo-element scaled from its left edge, so the
 * motion is a single composited property and the text never shifts. A border
 * that toggles on hover would reflow the row by a pixel, which is the kind of
 * thing nobody can name and everybody notices.
 */
function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text-muted hover:text-text relative rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium transition-colors after:absolute after:right-3 after:bottom-1 after:left-3 after:h-px after:origin-left after:scale-x-0 after:bg-[var(--color-signal)] after:transition-transform after:duration-[var(--duration-fast)] after:ease-[var(--ease-out-soft)] hover:after:scale-x-100"
    >
      {children}
    </Link>
  );
}
