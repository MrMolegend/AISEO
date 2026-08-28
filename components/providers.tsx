'use client';

import { DemoProvider } from '@/lib/store/demo-store';
import { ThemeProvider } from '@/lib/store/theme';
import { ToastProvider } from '@/lib/store/toast';

/**
 * One client boundary at the root. Everything below can stay a server component
 * unless it genuinely needs state — the providers do not force that.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <DemoProvider>{children}</DemoProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
