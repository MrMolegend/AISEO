'use client';

import { useRouter } from 'next/navigation';
import { useId, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  URL_REJECTION_MESSAGES,
  validateAndNormalizeUrl,
} from '@/lib/security/url-validator';

/**
 * The primary conversion surface.
 *
 * Client-side validation runs the *same* module the API route uses, so a user is
 * never accepted here and rejected server-side. The client check is purely for
 * instant feedback — the server re-validates everything regardless.
 */
export function UrlAuditForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    /*
     * Everything except the port rule is checked here for instant feedback.
     * Ports are left to the server, which is authoritative: the browser cannot
     * know whether this deployment permits a non-standard port, and guessing
     * wrong produces the worst outcome — an address the client rejects and the
     * server would have accepted. A server-side rejection is shown inline
     * below, so the only cost is one round-trip on a rare mistake.
     */
    const validation = validateAndNormalizeUrl(value, { allowNonStandardPorts: true });
    if (!validation.ok) {
      setError(URL_REJECTION_MESSAGES[validation.reason]);
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: validation.normalized }),
      });

      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          payload &&
          typeof payload === 'object' &&
          'error' in payload &&
          payload.error &&
          typeof payload.error === 'object' &&
          'body' in payload.error &&
          typeof payload.error.body === 'string'
            ? payload.error.body
            : 'We could not start that audit. Please try again.';
        setError(message);
        setSubmitting(false);
        return;
      }

      const publicId =
        payload && typeof payload === 'object' && 'publicId' in payload
          ? String(payload.publicId)
          : null;

      if (!publicId) {
        setError('We could not start that audit. Please try again.');
        setSubmitting(false);
        return;
      }

      // Deliberately not clearing `submitting`: the button stays in its loading
      // state through the navigation so the UI never flashes back to idle.
      router.push(`/audit/${publicId}`);
    } catch {
      setError('We could not reach the server. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full">
      <label htmlFor={inputId} className="sr-only">
        Website address to audit
      </label>

      <div
        className={cn(
          'bg-surface flex flex-col gap-2 rounded-[var(--radius-panel)] border p-2 transition-shadow sm:flex-row sm:items-center',
          error ? 'border-[var(--color-severity-critical-line)]' : 'border-line-strong',
          'shadow-[var(--shadow-card)] focus-within:shadow-[var(--shadow-raised)]',
        )}
      >
        <input
          ref={inputRef}
          id={inputId}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={submitting}
          placeholder="yourwebsite.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="text-ink placeholder:text-ink-faint h-12 min-w-0 flex-1 bg-transparent px-4 outline-none disabled:opacity-60 sm:h-12"
        />

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="h-12 w-full shrink-0 sm:w-auto"
        >
          {submitting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Starting audit
            </>
          ) : (
            <>
              Run free audit
              <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      </div>

      {/* Live region so the error is announced, not just shown. */}
      <div aria-live="polite" className="min-h-6">
        {error ? (
          <p
            id={errorId}
            className="mt-2 flex items-start gap-1.5 px-1 text-sm text-[var(--color-severity-critical)]"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
