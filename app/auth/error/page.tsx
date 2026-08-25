import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { pageTitle } from '@/config/brand';

export const metadata: Metadata = {
  title: pageTitle('Sign-in problem'),
  robots: { index: false, follow: false },
};

/**
 * Where a link that cannot be used lands.
 *
 * Each reason says what actually happened and what to do next. The version this
 * replaces said "we could not sign you in" for every case, which left the user
 * with no way to tell a link they had already clicked from one their mail
 * client had truncated — and no idea whether trying again would help.
 *
 * None of these mention Supabase, a token, or a status code. They are written
 * for the person holding the phone.
 */
const REASONS = {
  expired: {
    title: 'That link has expired',
    body: 'Sign-in links last an hour and work only once. Requesting a new one takes a moment.',
    action: { href: '/sign-in', label: 'Request a new link' },
  },
  incomplete: {
    title: 'That link arrived incomplete',
    body: 'Some email clients shorten long links. Try opening the email in a browser, or request a new link and click it rather than copying it.',
    action: { href: '/sign-in', label: 'Request a new link' },
  },
  invalid: {
    title: 'We could not use that link',
    body: 'It may have been altered on the way, or it may belong to a different site. Requesting a fresh one is the quickest fix.',
    action: { href: '/sign-in', label: 'Request a new link' },
  },
  unavailable: {
    title: 'We could not sign you in',
    body: 'Something went wrong on our side rather than with your link. It is worth trying again in a moment.',
    action: { href: '/sign-in', label: 'Back to sign in' },
  },
} as const;

type Reason = keyof typeof REASONS;

function isReason(value: string | undefined): value is Reason {
  return value !== undefined && value in REASONS;
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy = REASONS[isReason(reason) ? reason : 'unavailable'];

  return (
    <AuthShell
      title={copy.title}
      subtitle={copy.body}
      footer={
        <>
          Need a different address?{' '}
          <Link
            href="/sign-up"
            className="text-brand hover:text-brand-hover focus-visible:ring-brand rounded font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Link href={copy.action.href} className="block">
        <Button size="lg" className="w-full">
          {copy.action.label}
        </Button>
      </Link>
    </AuthShell>
  );
}
