'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, RefreshCw, Repeat, Settings } from 'lucide-react';
import { Menu, MenuItem, MenuSection } from '@/components/ui/menu';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useDemo } from '@/lib/store/demo-store';
import { useToast } from '@/lib/store/toast';
import { DASHBOARD_HOME, ROLE_LABELS } from '@/lib/nav';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const ROLES: Role[] = ['student', 'parent', 'tutor', 'admin'];

/**
 * The signed-in menu. The role switcher is a demonstration convenience — it
 * exists so every dashboard can be reviewed without four sign-ins, and it is
 * labelled as such rather than pretending to be a product feature.
 */
export function AccountMenu({ tone = 'default' }: { tone?: 'default' | 'inverse' }) {
  const { account, signOut, signInAsRole, resetDemo } = useDemo();
  const { toast } = useToast();
  const router = useRouter();

  if (!account) return null;

  return (
    <Menu
      label="Account"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'flex h-11 items-center gap-2 rounded-[var(--radius-control)] pr-2 pl-1.5 transition-colors duration-[var(--duration-fast)]',
            tone === 'inverse'
              ? 'text-white hover:bg-white/10'
              : 'text-ink hover:bg-surface-sunken',
          )}
        >
          <Avatar
            firstName={account.firstName}
            lastName={account.lastName}
            tone={account.avatarTone}
            size="sm"
          />
          <span className="hidden text-sm font-medium sm:inline">
            {account.firstName}
          </span>
          <ChevronDown
            className={cn(
              'size-4 transition-transform duration-[var(--duration-fast)]',
              open && 'rotate-180',
            )}
            aria-hidden
          />
          <span className="sr-only">Open account menu</span>
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-line border-b px-3.5 py-3">
            <p className="text-ink text-sm font-semibold">
              {account.firstName} {account.lastName}
            </p>
            <p className="text-ink-subtle truncate text-xs">{account.email}</p>
            <p className="text-brand-ink bg-brand-subtle mt-2 inline-block rounded px-1.5 py-0.5 text-[0.6875rem] font-medium">
              {ROLE_LABELS[account.role]}
            </p>
          </div>

          <div className="py-1">
            <Link
              href={DASHBOARD_HOME[account.role]}
              onClick={close}
              role="menuitem"
              className="text-ink hover:bg-surface-sunken flex items-center gap-2.5 px-3.5 py-2.5 text-sm"
            >
              <Settings className="size-4" aria-hidden />
              Go to dashboard
            </Link>
          </div>

          <MenuSection label="Demo role switcher">
            {ROLES.map((role) => (
              <MenuItem
                key={role}
                onClick={() => {
                  const next = signInAsRole(role);
                  close();
                  if (next) {
                    router.push(DASHBOARD_HOME[role]);
                    toast({
                      title: `Now viewing as ${next.firstName}`,
                      description: `${ROLE_LABELS[role]} dashboard`,
                    });
                  }
                }}
                className={cn(account.role === role && 'text-brand font-medium')}
              >
                <Repeat className="size-4" aria-hidden />
                {ROLE_LABELS[role]}
              </MenuItem>
            ))}
          </MenuSection>

          <MenuSection label="Appearance">
            <div className="px-3.5 pt-1 pb-2.5">
              <ThemeToggle />
            </div>
          </MenuSection>

          <MenuSection label="Session">
            <MenuItem
              onClick={() => {
                resetDemo();
                close();
                toast({
                  title: 'Demo data reset',
                  description:
                    'Bookings, messages and favourites are back to the seed set.',
                  tone: 'info',
                });
                router.push('/');
              }}
            >
              <RefreshCw className="size-4" aria-hidden />
              Reset demo data
            </MenuItem>
            <MenuItem
              onClick={() => {
                signOut();
                close();
                toast({ title: 'Signed out', tone: 'info' });
                router.push('/');
              }}
            >
              <LogOut className="size-4" aria-hidden />
              Sign out
            </MenuItem>
          </MenuSection>
        </div>
      )}
    </Menu>
  );
}
