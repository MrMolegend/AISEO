import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { getCurrentUser } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { BRAND } from '@/config/brand';
import { AccountMenu } from './account-menu';
import { MobileNav } from './mobile-nav';

/**
 * Site header.
 *
 * A Server Component, so the signed-in state is resolved on the server and the
 * page never flashes a signed-out header before correcting itself. Identity
 * comes from a verified JWT, never from anything the browser volunteered.
 *
 * Both states are deliberately explicit. Signed out shows Sign in *and* Create
 * account, because "sign in" alone reads as a wall to someone who has never
 * been here. Signed in shows who you are and what you have, at every width —
 * the previous version hid the navigation below `md` and the balance below
 * `sm`, with no menu in their place, so a phone user saw a logo and a circle.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  let balance: { available: number; reserved: number } | null = null;
  if (user) {
    const wallet = await getTokenWallet();
    balance = await wallet.getBalance(user.id);
  }

  const links = user
    ? [
        { href: '/dashboard', label: 'Dashboard' },
        { href: '/research/new', label: 'New research' },
        { href: '/wallet', label: BRAND.currency.name },
        { href: '/pricing', label: 'Pricing' },
      ]
    : [{ href: '/pricing', label: 'Pricing' }];

  return (
    <header className="border-line bg-surface/90 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-5 md:px-8">
        <Link
          href={user ? '/dashboard' : '/'}
          className="focus-visible:ring-brand rounded-[var(--radius-control)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label={`${BRAND.name} home`}
        >
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-2 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <HeaderLink key={link.href} href={link.href}>
              {link.label}
            </HeaderLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <AccountMenu email={user.email} balance={balance} />
          ) : (
            <>
              <Link
                href="/sign-in"
                className="text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:ring-brand inline-flex h-9 items-center rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Sign in
              </Link>
              {/* Both buttons plus the menu trigger overflow a 360px viewport,
                  so below `sm` this one lives in the menu instead. Sign in stays
                  visible, because someone who already has an account should
                  never have to open a menu to use it. */}
              <Link
                href="/sign-up"
                className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand hidden h-9 items-center rounded-[var(--radius-control)] px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex"
              >
                Create account
              </Link>
            </>
          )}

          {/* Below md this is the only route to the navigation, so it exists in
              both states rather than only when signed in. */}
          <MobileNav links={links} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-ink-muted hover:bg-surface-sunken hover:text-ink focus-visible:ring-brand rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
