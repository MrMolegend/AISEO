import Link from 'next/link';
import { BRAND } from '@/config/brand';

export function SiteFooter() {
  return (
    <footer className="border-line mt-24 border-t">
      <div className="mx-auto max-w-[1240px] px-5 py-10 md:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <p className="text-ink text-sm font-semibold">{BRAND.name}</p>
            <p className="text-ink-subtle mt-1.5 text-sm leading-relaxed">
              {BRAND.tagline}. Every factual claim carries a link to where we found it.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </nav>
        </div>

        <p className="text-ink-faint mt-8 text-xs leading-relaxed">
          {BRAND.currency.disclaimer}
        </p>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-ink-subtle hover:text-ink focus-visible:ring-brand rounded text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
