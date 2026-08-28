'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Menu } from '@/components/ui/menu';
import { useDemo } from '@/lib/store/demo-store';
import { getNotificationsForRole } from '@/lib/queries';
import { formatRelativeTime } from '@/lib/datetime';
import { cn } from '@/lib/utils';

export function NotificationMenu({ tone = 'default' }: { tone?: 'default' | 'inverse' }) {
  const { role, dismissedNotifications, dismissNotification, hydrated } = useDemo();
  if (!role) return null;

  const all = getNotificationsForRole(role);
  const unread = all.filter((n) => !dismissedNotifications.includes(n.id));
  const count = hydrated ? unread.length : 0;

  return (
    <Menu
      label="Notifications"
      panelClassName="w-[min(22rem,calc(100vw-2rem))]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'relative flex size-11 items-center justify-center rounded-[var(--radius-control)] transition-colors duration-[var(--duration-fast)]',
            tone === 'inverse'
              ? 'text-white hover:bg-white/10'
              : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
          )}
        >
          <Bell className="size-5" aria-hidden />
          {count > 0 && (
            <span
              className="bg-brand text-on-brand absolute top-2 right-2 flex size-4 items-center justify-center rounded-full text-[0.5625rem] font-semibold"
              aria-hidden
            >
              {count}
            </span>
          )}
          <span className="sr-only">
            Notifications{count > 0 ? `, ${count} unread` : ''}
          </span>
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="border-line flex items-center justify-between border-b px-3.5 py-2.5">
            <p className="text-sm font-semibold">Notifications</p>
            <span className="text-ink-subtle text-xs">{count} unread</span>
          </div>
          {all.length === 0 ? (
            <p className="text-ink-subtle px-3.5 py-6 text-center text-sm">
              Nothing to catch up on.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {all.map((item) => {
                const read = dismissedNotifications.includes(item.id);
                return (
                  <li key={item.id} className="border-line border-b last:border-b-0">
                    <Link
                      href={item.href}
                      onClick={() => {
                        dismissNotification(item.id);
                        close();
                      }}
                      className="hover:bg-surface-sunken block px-3.5 py-3"
                    >
                      <span className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            'mt-1.5 size-1.5 shrink-0 rounded-full',
                            read ? 'bg-line-strong' : 'bg-brand',
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span
                            className={cn(
                              'block text-sm',
                              read ? 'text-ink-muted' : 'text-ink font-medium',
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="text-ink-subtle mt-0.5 block text-xs leading-relaxed">
                            {item.body}
                          </span>
                          <span className="text-ink-subtle mt-1 block text-[0.6875rem]">
                            {formatRelativeTime(item.at)}
                            {read && ' · read'}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Menu>
  );
}
