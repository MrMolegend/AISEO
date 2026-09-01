import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { Meta } from '@/components/ui/panel';
import { BRAND } from '@/config/brand';

/**
 * The footer.
 *
 * Carries the two disclosures that belong on every page rather than only where
 * they are convenient: that reports are research and not advice, and what a
 * report credit is. Burying either in a terms page would be the kind of
 * technically-compliant that nobody defends afterwards.
 */
export function SiteFooter() {
  /*
   * `print:hidden`: the site footer is chrome, not document. The dossier prints
   * its own sources and limitations, and a column of site links after them is
   * noise on paper.
   */
  return (
    <footer className="border-rule mt-24 border-t print:hidden">
      <div className="mx-auto max-w-[var(--container-page)] px-5 py-12 md:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <Logo />
            <p className="text-text-muted measure mt-4 text-[14px] leading-relaxed">
              {BRAND.tagline} Every factual claim in a dossier carries a link to the
              source it came from, and every dossier says what it could not establish.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-2.5">
            <Meta className="mb-1">This site</Meta>
            <FooterLink href="/example">Example report</FooterLink>
            <FooterLink href="/methodology">Research methodology</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </nav>
        </div>

        <div className="border-rule mt-12 space-y-2 border-t pt-6">
          <p className="text-text-faint text-[12px] leading-relaxed">
            Reports are research assembled from public sources, not legal, regulatory or
            financial advice. Verify anything you are about to spend money against with
            the relevant authority or a qualified adviser first.
          </p>
          <p className="text-text-faint text-[12px] leading-relaxed">
            {BRAND.credit.disclaimer}
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
