import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { pageTitle } from '@/config/brand';

export const metadata: Metadata = {
  title: pageTitle('Sign-in link'),
  robots: { index: false, follow: false },
};

/**
 * Where an unusable sign-in link ends up.
 *
 * Every one of these states is fixed the same way — ask for a new link — so the
 * page says what happened and puts that action in front of the reader rather
 * than explaining token lifetimes.
 */
const STATES = {
  expired: {
    title: 'That link has expired',
    body: 'Sign-in links last an hour and work once. Ask for a fresh one and it will work.',
  },
  missing: {
    title: 'That link is incomplete',
    body: 'Some email clients trim long links. Opening it from a different client, or asking for a new one, usually fixes it.',
  },
  error: {
    title: 'We could not sign you in',
    body: 'Something went wrong on our side. Requesting a new link is the quickest way through.',
  },
} as const;

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const copy = STATES[(state as keyof typeof STATES) ?? 'error'] ?? STATES.error;

  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16"
    >
      <Link
        href="/"
        className="focus-visible:ring-brand mb-10 self-start rounded focus-visible:ring-2 focus-visible:outline-none"
      >
        <Logo />
      </Link>

      <h1 className="text-ink text-[30px] leading-tight font-semibold tracking-[var(--tracking-display)]">
        {copy.title}
      </h1>
      <p className="text-ink-muted mt-3 leading-relaxed">{copy.body}</p>

      <Link
        href="/sign-in"
        className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand mt-8 inline-flex h-12 items-center justify-center rounded-[var(--radius-control)] px-6 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        Request a new link
      </Link>
    </main>
  );
}
