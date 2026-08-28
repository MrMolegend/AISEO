'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Form primitives.
 *
 * The label, the control and the error message are wired together with real
 * ids: `aria-describedby` for helper text, `aria-invalid` plus a linked message
 * for errors. Nothing here relies on colour alone to signal a problem.
 */

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => React.ReactNode;
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-ink block text-sm font-medium">
        {label}
        {required && (
          <span className="text-danger ml-1" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {hint && (
        <p id={hintId} className="text-ink-subtle text-sm">
          {hint}
        </p>
      )}
      {children({ id, describedBy })}
      {error && (
        <p id={errorId} className="text-danger flex items-start gap-1.5 text-sm">
          <span aria-hidden>•</span>
          {error}
        </p>
      )}
    </div>
  );
}

const controlClasses =
  'border-line-strong bg-surface text-ink placeholder:text-ink-subtle/80 w-full rounded-[var(--radius-control)] border px-3.5 text-[0.9375rem] transition-colors duration-[var(--duration-fast)] hover:border-ink-subtle/60 focus:border-brand aria-[invalid=true]:border-danger';

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClasses, 'h-11', className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(controlClasses, 'min-h-28 py-2.5', className)} {...props} />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        controlClasses,
        'h-11 appearance-none bg-[length:1.1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9',
        // Chevron drawn as a data URI so no icon component is needed inside a
        // native select.
        "bg-[url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        className="accent-brand mt-0.5 size-[18px] shrink-0 cursor-pointer"
        {...props}
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug">
        <span className="text-ink font-medium">{label}</span>
        {description && <span className="text-ink-subtle block">{description}</span>}
      </label>
    </div>
  );
}

/** A radio rendered as a selectable panel — used for role and duration choices. */
export function RadioCard({
  name,
  value,
  checked,
  onChange,
  title,
  description,
  icon,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="relative">
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="peer sr-only"
      />
      <label
        htmlFor={id}
        className={cn(
          'border-line bg-surface hover:border-line-strong peer-focus-visible:outline-brand flex cursor-pointer items-start gap-3 rounded-[var(--radius-card)] border p-4 transition-colors duration-[var(--duration-fast)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
          checked && 'border-brand bg-brand-subtle/50',
        )}
      >
        {icon && <span className="text-brand mt-0.5 shrink-0">{icon}</span>}
        <span className="min-w-0">
          <span className="text-ink block text-sm font-semibold">{title}</span>
          {description && (
            <span className="text-ink-subtle mt-0.5 block text-sm">{description}</span>
          )}
        </span>
      </label>
    </div>
  );
}

/** A labelled on/off control used in settings screens. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="text-ink block text-sm font-medium">{label}</span>
        {description && (
          <span className="text-ink-subtle mt-0.5 block text-sm">{description}</span>
        )}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-[var(--duration-fast)]',
          checked ? 'bg-brand border-brand' : 'bg-surface-sunken border-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-4.5 rounded-full bg-white shadow-sm transition-[left] duration-[var(--duration-fast)]',
            checked ? 'left-[1.375rem]' : 'left-0.5',
          )}
          aria-hidden
        />
        <span className="sr-only">{label}</span>
      </button>
    </div>
  );
}
