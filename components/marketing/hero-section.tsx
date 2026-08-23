import Link from 'next/link';
import { UrlAuditForm } from './url-audit-form';

export function HeroSection() {
  return (
    <section id="audit" className="relative overflow-hidden">
      {/*
        A single, very soft radial wash. Enough to lift the hero off the page;
        far short of the glow-heavy treatment that reads as an AI demo.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,var(--color-brand-subtle),transparent_70%)]"
      />

      <div className="mx-auto max-w-[1240px] px-5 pt-16 pb-20 md:px-8 md:pt-24 md:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-ink-subtle text-sm font-medium">
            Free · No account required
          </p>

          <h1 className="mt-4 text-[2.5rem] leading-[1.08] font-semibold sm:text-[3.25rem] md:text-[3.75rem]">
            Find out what is holding your website back
          </h1>

          <p className="text-ink-muted measure mx-auto mt-6 text-lg leading-relaxed md:text-xl">
            Enter your address and get an AI-powered SEO and growth audit in about a
            minute — scores, prioritised issues, and a plan written for people who do not
            do SEO for a living.
          </p>

          <div className="mx-auto mt-10 max-w-xl">
            <UrlAuditForm />
          </div>

          <p className="text-ink-faint mt-1 text-sm">
            Or{' '}
            <Link
              href="/sample"
              className="text-brand underline-offset-4 hover:underline"
            >
              look at a sample report
            </Link>{' '}
            first.
          </p>
        </div>
      </div>
    </section>
  );
}
