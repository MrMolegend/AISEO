'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MIN_HUMAN_FORM_MS } from '@/schemas/api';
import { cn } from '@/lib/utils';

/**
 * The lead capture CTA.
 *
 * Deliberately the last thing on the page and nothing else: no modal, no
 * interstitial, no gate in front of the report. The report is the product; this
 * is an offer made after it has been delivered, which is the only version of
 * this that does not damage the thing it is attached to.
 */
export function LeadCapture({
  auditPublicId,
  domain,
}: {
  auditPublicId: string;
  domain: string;
}) {
  const formId = useId();
  const mountedAt = useRef<number | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mountedAt.current ??= Date.now();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === 'sending') return;

    const form = new FormData(event.currentTarget);
    setState('sending');
    setError(null);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          email: String(form.get('email') ?? ''),
          company: String(form.get('company') ?? ''),
          website: String(form.get('website') ?? domain),
          message: String(form.get('message') ?? ''),
          auditPublicId,
          companyWebsiteUrl: String(form.get('companyWebsiteUrl') ?? ''),
          elapsedMs: mountedAt.current
            ? Date.now() - mountedAt.current
            : MIN_HUMAN_FORM_MS,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { body?: string };
        } | null;
        setError(payload?.error?.body ?? 'Something went wrong. Please try again.');
        setState('error');
        return;
      }

      setState('sent');
    } catch {
      setError('We could not reach the server. Please try again.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <section className="border-line bg-surface-subtle mt-20 rounded-[var(--radius-panel)] border p-6 text-center md:p-10">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-[var(--color-score-good-bg)]">
          <Check className="size-5 text-[var(--color-score-good)]" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-semibold">Thanks — message received</h2>
        <p className="text-ink-muted mt-2 text-[15px]">
          We will get back to you shortly.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={formId}
      className="border-line bg-surface-subtle mt-20 rounded-[var(--radius-panel)] border p-6 md:p-10"
    >
      <div className="max-w-xl">
        <h2 id={formId} className="text-xl font-semibold md:text-2xl">
          Want help implementing these recommendations?
        </h2>
        <p className="text-ink-muted mt-2 text-[15px] leading-relaxed">
          Tell us what you are trying to achieve and we will come back with a plan. No
          obligation, and we will not add you to a mailing list.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
        {/*
          Honeypot: positioned off-screen rather than display:none, because some
          bots skip hidden inputs. A human never reaches it — it is out of the tab
          order and labelled as ignorable.
        */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor={`${formId}-hp`}>Do not fill this in</label>
          <input
            id={`${formId}-hp`}
            name="companyWebsiteUrl"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" name="name" required autoComplete="name" />
          <Field label="Email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" name="company" autoComplete="organization" />
          <Field
            label="Website"
            name="website"
            defaultValue={domain}
            autoComplete="url"
          />
        </div>

        <div>
          <label
            htmlFor={`${formId}-message`}
            className="text-ink block text-sm font-medium"
          >
            What would you like help with?
          </label>
          <textarea
            id={`${formId}-message`}
            name="message"
            rows={4}
            className="border-line-strong bg-surface text-ink placeholder:text-ink-faint mt-1.5 w-full rounded-[var(--radius-control)] border px-3.5 py-2.5 outline-none"
            placeholder="Optional — a sentence is plenty."
          />
        </div>

        <div aria-live="polite">
          {error ? (
            <p className="text-sm text-[var(--color-severity-critical)]">{error}</p>
          ) : null}
        </div>

        <Button type="submit" size="lg" disabled={state === 'sending'}>
          {state === 'sending' ? (
            <>
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Sending
            </>
          ) : (
            'Send message'
          )}
        </Button>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required = false,
  defaultValue,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
        {required ? <span className="text-ink-faint"> *</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className={cn(
          'border-line-strong bg-surface text-ink placeholder:text-ink-faint mt-1.5 h-11 w-full rounded-[var(--radius-control)] border px-3.5 outline-none',
        )}
      />
    </div>
  );
}
