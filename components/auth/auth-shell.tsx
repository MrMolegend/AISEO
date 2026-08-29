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
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,520px)]">
      {/*
       * The left panel is decoration with a job.
       *
       * These pages are the one place a person checks they are on the site they
       * think they are on, so the mark and a sentence of context earn their
       * space. It is hidden below `lg` rather than stacked: on a phone the
       * fastest thing this page can do is put a field under the heading.
       */}
      <aside
        aria-hidden="true"
        className="bg-ground-sunken relative hidden overflow-hidden lg:block"
      >
        <div className="grid-field animate-drift absolute -inset-x-16 -inset-y-16 opacity-60" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <p className="font-display text-text max-w-[16ch] text-[34px] leading-[1.1]">
              Enter new markets with evidence.
            </p>
            <p className="text-text-muted mt-4 max-w-[42ch] text-[14px] leading-relaxed">
              Every factual claim in a dossier carries a link to the source it came from,
              and every dossier says what it could not establish.
            </p>
          </div>
        </div>
      </aside>

      <main
        id="main"
        className="mx-auto flex w-full max-w-md flex-col justify-center px-5 py-12 lg:px-10"
      >
        <div className="mb-8 lg:hidden">
          <Link
            href="/"
            className="inline-flex rounded-[var(--radius-control)] focus-visible:outline-none"
          >
            <Logo />
          </Link>
        </div>

        <h1 className="font-display text-text text-[30px] leading-tight tracking-[var(--tracking-display)]">
          {title}
        </h1>
        {subtitle && (
          <div className="text-text-muted mt-3 text-[15px] leading-relaxed">
            {subtitle}
          </div>
        )}

        <div className="mt-8">{children}</div>

        {footer && <div className="text-text-muted mt-8 text-[14px]">{footer}</div>}

        <p className="mt-12">
          <Link
            href="/"
            className="text-text-subtle hover:text-text inline-flex items-center gap-1.5 rounded-[var(--radius-control)] text-[13px] transition-colors"
          >
            <span aria-hidden="true">←</span> Back to home
          </Link>
        </p>
      </main>
    </div>
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
  /* Square, with a coloured leading edge rather than a tinted rounded box —
     the same device the rest of the product uses to say what something is. */
  const styles = {
    error: 'border-copper',
    info: 'border-rule-strong',
    success: 'border-signal',
  } as const;

  return (
    <div
      id={id}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={`bg-ground-raised border-l-[3px] p-4 ${styles[tone]}`}
    >
      {title && <p className="text-text text-[14px] font-medium">{title}</p>}
      <div
        className={`text-text-muted text-[14px] leading-relaxed ${title ? 'mt-1.5' : ''}`}
      >
        {children}
      </div>
    </div>
  );
}
