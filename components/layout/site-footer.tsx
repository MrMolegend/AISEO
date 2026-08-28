import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';
import { FOOTER_LINKS } from '@/lib/nav';

export function SiteFooter() {
  return (
    <footer className="border-line bg-surface mt-24 border-t">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,1fr))]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <LogoMark className="size-7" />
              <span className="text-[1.0625rem] font-semibold tracking-[-0.02em]">
                Tutor Hub
              </span>
            </div>
            <p className="text-ink-subtle mt-3 text-sm leading-relaxed">
              An online tutoring marketplace for GCSE, A-Level, university and adult
              learners across the UK. Compare tutors, book a time and learn in one place.
            </p>
          </div>

          {FOOTER_LINKS.map((group) => (
            <nav key={group.heading} aria-labelledby={`footer-${group.heading}`}>
              <h2
                id={`footer-${group.heading}`}
                className="text-ink text-sm font-semibold"
              >
                {group.heading}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${group.heading}-${link.href}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-ink-subtle hover:text-brand text-sm transition-colors duration-[var(--duration-fast)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-line mt-12 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-subtle text-sm">
            © {new Date().getUTCFullYear()} Tutor Hub. Registered in England.
          </p>
          <p className="text-ink-subtle text-sm">
            This build is a frontend demonstration — no payments are taken and no accounts
            are created.
          </p>
        </div>
      </div>
    </footer>
  );
}
