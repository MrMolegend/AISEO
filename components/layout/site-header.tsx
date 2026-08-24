import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { getCurrentUser } from '@/lib/auth/server';
import { getTokenWallet } from '@/lib/tokens';
import { BRAND } from '@/config/brand';
import { formatTokens } from '@/config/tokens';
import { AccountMenu } from './account-menu';

/**
 * Site header.
 *
 * A Server Component, so the signed-in state is resolved on the server and the
 * page never flashes a signed-out header before correcting itself. The balance
 * is read here too — it is one query and it is the number a user most wants to
 * see before starting anything.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  let balance: { available: number; reserved: number } | null = null;
  if (user) {
    const wallet = await getTokenWallet();
    balance = await wallet.getBalance(user.id);
  }

  return (
    <header className="border-line bg-surface/90 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-5 md:px-8">
        <Link
          href={user ? '/dashboard' : '/'}
          className="focus-visible:ring-brand rounded-[var(--radius-control)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label={`${BRAND.name} home`}
        >
          <Logo />
        </Link>

        <nav aria-label="Main" className="ml-2 hidden items-center gap-1 md:flex">
          {user && <HeaderLink href="/dashboard">Dashboard</HeaderLink>}
          <HeaderLink href="/pricing">Pricing</HeaderLink>
          {user && <HeaderLink href="/wallet">Wallet</HeaderLink>}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user && balance ? (
            <>
              <Link
                href="/wallet"
                className="border-line bg-surface-subtle text-ink hover:border-line-strong focus-visible:ring-brand hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:inline-flex"
              >
                <span className="text-ink font-semibold">
                  {formatTokens(balance.available)}
                </span>
                <span className="text-ink-subtle">{BRAND.currency.plural}</span>
                {balance.reserved > 0 && (
                  <span
                    className="text-ink-faint"
                    title="Held against research that is still running"
                  >
                    · {formatTokens(balance.reserved)} held
                  </span>
                )}
              </Link>
              <AccountMenu email={user.email} />
            </>
          ) : (
            <Link
              href="/sign-in"
              className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand inline-flex h-9 items-center rounded-[var(--radius-control)] px-4 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Sign in
            </Link>
          )}
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
