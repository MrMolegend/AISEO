import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

/**
 * The frame every standalone authentication page sits in.
 *
 * These pages deliberately do not use SiteHeader. A header carrying a token
 * balance and an account menu is noise on a page whose only job is one field,
 * and half of it would be wrong anyway — you are mid-way through proving who
 * you are. What a person needs here is the mark, so they can see they are on
 * the right site, and a way back out.
 *
 * "Back to home" is a real link rather than browser back: someone who arrived
 * from an email has no history to go back to.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  /** Sign-in/sign-up cross-links. Rendered below the card, quieter. */
  footer?: React.ReactNode;
}) {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-12"
    >
      <div className="mb-8">
        <Link
          href="/"
          className="focus-visible:ring-cobalt inline-flex rounded-[var(--radius-control)] focus-visible:ring-2 focus-visible:outline-none"
        >
          <Logo />
        </Link>
      </div>

      <h1 className="text-text text-[26px] leading-tight font-semibold tracking-[var(--tracking-display)]">
        {title}
      </h1>
      {subtitle && (
        <div className="text-text-muted mt-2.5 leading-relaxed">{subtitle}</div>
      )}

      <div className="mt-8">{children}</div>

      {footer && <div className="text-text-muted mt-8 text-sm">{footer}</div>}

      <p className="mt-10">
        <Link
          href="/"
          className="text-text-subtle hover:text-text focus-visible:ring-cobalt inline-flex items-center gap-1.5 rounded-[var(--radius-control)] text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span aria-hidden="true">←</span> Back to home
        </Link>
      </p>
    </main>
  );
}

/**
 * A status or error message that a screen reader will actually announce.
 *
 * `alert` is assertive and interrupts; `status` is polite and waits. The
 * difference matters: an error the user must act on should cut in, a
 * confirmation should not talk over them.
 */
export function AuthMessage({
  tone,
  title,
  children,
  id,
}: {
  tone: 'error' | 'info' | 'success';
  title?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const styles = {
    error:
      'border-[var(--color-copper-line)] bg-[var(--color-copper-surface)]',
    info: 'border-rule bg-ground-raised',
    success: 'border-cobalt-line bg-cobalt-surface',
  } as const;

  return (
    <div
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`rounded-[var(--radius-panel)] border p-4 ${styles[tone]}`}
    >
      {title && <p className="text-text text-sm font-semibold">{title}</p>}
      <div className={`text-text-muted text-sm leading-relaxed ${title ? 'mt-1' : ''}`}>
        {children}
      </div>
    </div>
  );
}
