'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useDemo } from '@/lib/store/demo-store';

/**
 * Wraps an action that only makes sense for a signed-in person. With no demo
 * account selected it sends them to the sign-in screen with a `next` parameter,
 * which is exactly the shape a Supabase-backed guard will take later.
 */
export function useRequireAccount(): (action: () => void) => void {
  const { account, hydrated } = useDemo();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (action: () => void) => {
      if (!hydrated) return;
      if (!account) {
        router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
        return;
      }
      action();
    },
    [account, hydrated, pathname, router],
  );
}
