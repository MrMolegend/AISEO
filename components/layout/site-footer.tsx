import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Meta } from '@/components/ui/panel';
import { BRAND } from '@/config/brand';

/**
 * The footer.
 *
 * Internal-tool chrome: identity, the two legal pages, and the one
 * disclosure that belongs on every page — that research output is assembled
 * from public sources and is not advice. No marketing links; there is no
 * marketing surface to link to.
 */
export function SiteFooter() {
  /*
   * `print:hidden`: the site footer is chrome, not document. Printed briefs
   * carry their own sources and limitations, and a column of site links
   * after them is noise on paper.
   */
  return (
    <footer className="border-rule mt-24 border-t print:hidden">
      <div className="mx-auto max-w-[var(--container-page)] px-5 py-12 md:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <Logo />
            <p className="text-text-muted measure mt-4 text-[14px] leading-relaxed">
              {BRAND.tagline}. An internal platform of {BRAND.legalEntity}. Every material
              claim about an account carries the source it came from, and anything
              unverified says so.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2.5">
            <Meta className="mb-1">This site</Meta>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </nav>
        </div>

        <div className="border-rule mt-12 space-y-2 border-t pt-6">
          <p className="text-text-faint text-[12px] leading-relaxed">
            Research here is assembled from public sources and colleague confirmations. It
            is not legal or financial advice, and outreach drafts are proposals for human
            review — nothing sends automatically.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text-subtle hover:text-text w-fit rounded text-[13px] transition-colors"
    >
      {children}
    </Link>
  );
}
