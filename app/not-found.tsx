import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';
import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container-narrow flex min-h-dvh flex-col items-center justify-center py-16 text-center">
      <LogoMark className="size-10" />
      <p className="text-ink-subtle mt-6 text-sm font-medium">Page not found</p>
      <h1 className="mt-2 text-[1.75rem] tracking-[var(--tracking-tight)]">
        We could not find that page
      </h1>
      <p className="text-ink-muted mt-3 max-w-md leading-relaxed">
        The link may be out of date, or the tutor profile may no longer be published.
        Searching the marketplace is usually the quickest way back.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <ButtonLink href="/tutors" size="lg">
          Find a tutor
        </ButtonLink>
        <ButtonLink href="/" variant="secondary" size="lg">
          Back to the homepage
        </ButtonLink>
      </div>
      <p className="text-ink-subtle mt-8 text-sm">
        Still stuck?{' '}
        <Link href="/contact" className="text-brand hover:underline">
          Tell us what you were looking for
        </Link>
        .
      </p>
    </div>
  );
}
