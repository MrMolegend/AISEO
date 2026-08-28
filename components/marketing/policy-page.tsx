import Link from 'next/link';
import { Info } from 'lucide-react';

export interface PolicySection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

/**
 * Shared layout for the privacy, terms and safeguarding pages. Each one is a
 * real, readable summary of how the platform is intended to operate — marked
 * clearly as a plain-English outline rather than a finished legal document.
 */
export function PolicyPage({
  title,
  lead,
  updated,
  sections,
}: {
  title: string;
  lead: string;
  updated: string;
  sections: PolicySection[];
}) {
  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[2rem] tracking-[var(--tracking-display)]">{title}</h1>
        <p className="text-ink-muted mt-4 text-[1.0625rem] leading-relaxed">{lead}</p>
        <p className="text-ink-subtle mt-3 text-sm">Last reviewed {updated}</p>

        <div className="border-info-line bg-info-bg text-info mt-7 flex gap-3 rounded-[var(--radius-card)] border p-4">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-sm leading-relaxed">
            This is a plain-English outline of how Tutor Hub is designed to operate,
            written for a demonstration build. It is not a finished legal document and has
            not been reviewed by a solicitor.
          </p>
        </div>

        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl tracking-[var(--tracking-tight)]">
                {section.heading}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-ink-muted mt-3 leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="text-ink-muted mt-3 space-y-2">
                  {section.list.map((item) => (
                    <li key={item} className="flex gap-2.5 leading-relaxed">
                      <span
                        className="text-brand mt-1.5 size-1.5 shrink-0 rounded-full bg-current"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="border-line mt-12 border-t pt-6">
          <p className="text-ink-subtle text-sm">
            Questions about any of this?{' '}
            <Link href="/contact" className="text-brand hover:underline">
              Contact the Tutor Hub team
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
