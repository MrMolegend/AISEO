import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { BRAND } from '@/config/brand';
import { creditsFrom } from '@/config/report';
import { AccountMenu } from './account-menu';
import { MobileNav } from './mobile-nav';
import { ScrollShrink } from './scroll-shrink';

/**
 * Site header.
 *
 * A Server Component, so the signed-in state is resolved on the server and the
 * page never flashes a signed-out header before correcting itself. Identity
 * comes from a verified JWT, never from anything the browser volunteered.
 *
 * What it shows a signed-in visitor is a count of report credits, not a token
 * balance. The conversion happens here, on the server, so no token figure is
 * ever sent to the browser — there is nothing in the markup for a later change
 * to accidentally reveal.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  let credits: number | null = null;
  if (user) {
    const wallet = await getTokenWallet();
    const balance = await wallet.getBalance(user.id);
    credits = creditsFrom(balance.available);
  }

  const links = user
    ? [
        { href: '/dashboard', label: 'Intelligence Desk' },
        { href: '/assess', label: 'Assess a market' },
        { href: '/methodology', label: 'Methodology' },
      ]
    : [
        { href: '/#how-it-works', label: 'How it works' },
        { href: '/example', label: 'Example report' },
        { href: '/methodology', label: 'Methodology' },
      ];

  return (
    <ScrollShrink>
      <div className="mx-auto flex h-[var(--header-height)] max-w-[var(--container-page)] items-center gap-4 px-5 transition-[height] duration-[var(--duration-base)] ease-[var(--ease-out-soft)] md:px-8">
        <Link
          href={user ? '/dashboard' : '/'}
          className="text-text rounded-[var(--radius-control)] focus-visible:outline-none"
          aria-label={`${BRAND.name} home`}
        >
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <HeaderLink key={link.href} href={link.href}>
              {link.label}
            </HeaderLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <AccountMenu email={user.email} credits={credits ?? 0} />
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-text-muted hover:text-text inline-flex h-9 items-center rounded-[var(--radius-control)] px-3 text-[13px] font-medium transition-colors"
              >
                Sign in
              </Link>
              {/* Both controls plus the menu trigger overflow a 320px viewport,
                  so below `sm` this one lives in the menu instead. Sign in
                  stays visible: someone who already has an account should never
                  have to open a menu to use it. */}
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/assess">Start report</Link>
              </Button>
            </>
          )}

          {/* Below md this is the only route to the navigation, so it exists in
              both states rather than only when signed in. */}
          <MobileNav links={links} signedIn={Boolean(user)} />
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
