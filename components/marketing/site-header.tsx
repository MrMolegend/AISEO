import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

export function SiteHeader() {
  return (
    <header className="border-line/70 bg-canvas/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 md:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="AISEO home">
          <Logo className="size-7" />
          <span className="text-[15px] font-semibold tracking-[var(--tracking-tight)]">
            AISEO
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/sample"
            className="text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors"
          >
            Sample report
          </Link>
          <Link
            href="/#audit"
            className="bg-brand text-ink-inverse hover:bg-brand-hover hidden rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium transition-colors sm:inline-flex"
          >
            Run an audit
          </Link>
        </nav>
      </div>
    </header>
  );
}
