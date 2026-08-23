import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

export function SiteFooter() {
  return (
    <footer className="border-line mt-24 border-t">
      <div className="mx-auto max-w-[1240px] px-5 py-12 md:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Logo className="size-6" />
              <span className="text-sm font-semibold tracking-[var(--tracking-tight)]">
                AISEO
              </span>
            </div>
            <p className="text-ink-subtle mt-3 text-sm leading-relaxed">
              AI-powered SEO audits that tell you what is wrong, why it matters and what
              to do first.
            </p>
          </div>

          <nav aria-label="Footer" className="flex gap-12">
            <div>
              <h2 className="text-ink text-xs font-semibold tracking-wide uppercase">
                Product
              </h2>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <Link
                    href="/sample"
                    className="text-ink-subtle hover:text-ink text-sm transition-colors"
                  >
                    Sample report
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#how-it-works"
                    className="text-ink-subtle hover:text-ink text-sm transition-colors"
                  >
                    How it works
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-ink text-xs font-semibold tracking-wide uppercase">
                Legal
              </h2>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <Link
                    href="/privacy"
                    className="text-ink-subtle hover:text-ink text-sm transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-ink-subtle hover:text-ink text-sm transition-colors"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <p className="text-ink-faint border-line mt-10 border-t pt-6 text-xs">
          © {new Date().getFullYear()} AISEO. Audits analyse publicly available page data.
        </p>
      </div>
    </footer>
  );
}
