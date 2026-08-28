'use client';
import { useId } from 'react';

/**
 * Form fields.
 *
 * Every field labels itself, describes itself, and announces its own errors —
 * which is not decoration. These forms are long, and a person filling one in on
 * a phone with a screen reader needs to know which field is required and why one
 * was rejected without hunting for a red outline they cannot see.
 *
 * Inputs are 16px minimum. Below that, iOS zooms the whole page on focus and the
 * user has to pinch back out for every field.
 */

interface BaseProps {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function FieldShell({
  label,
  hint,
  error,
  required,
  id,
  hintId,
  errorId,
  children,
}: BaseProps & {
  id: string;
  hintId: string;
  errorId: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-text mb-2 block text-sm font-medium">
        {label}
        {required ? (
          <span className="text-[var(--color-copper)]" aria-hidden="true">
            {' '}
            *
          </span>
        ) : (
          <span className="text-text-faint font-normal"> (optional)</span>
        )}
      </label>

      {children}

      {hint && (
        <p id={hintId} className="text-text-subtle mt-1.5 text-sm leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-sm text-[var(--color-copper)]"
        >
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass =
  'border-rule-strong bg-ground-raised text-text placeholder:text-text-faint focus:border-cobalt focus-visible:ring-cobalt w-full rounded-[var(--radius-control)] border px-4 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none aria-[invalid=true]:border-[var(--color-copper)]';

export function TextField({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  ...base
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'url' | 'email' | 'numeric';
  autoComplete?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <FieldShell {...base} id={id} hintId={hintId} errorId={errorId}>
      <input
        id={id}
        name={base.name}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        autoCapitalize={inputMode === 'url' || inputMode === 'email' ? 'off' : undefined}
        spellCheck={inputMode === 'url' || inputMode === 'email' ? false : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={base.required}
        aria-invalid={Boolean(base.error)}
        aria-describedby={
          [base.hint ? hintId : null, base.error ? errorId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        className={`${inputClass} h-12`}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  ...base
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;

  return (
    <FieldShell {...base} id={id} hintId={hintId} errorId={errorId}>
      <textarea
        id={id}
        name={base.name}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-required={base.required}
        aria-invalid={Boolean(base.error)}
        aria-describedby={
          [
            base.hint ? hintId : null,
            maxLength ? counterId : null,
            base.error ? errorId : null,
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
        className={`${inputClass} resize-y py-3 leading-relaxed`}
      />
      {maxLength && (
        <p
          id={counterId}
          className="text-text-faint mt-1 text-right text-xs tabular-nums"
        >
          {/* Live, so someone who cannot see the counter still hears it as they
              approach the limit rather than discovering it on submit. */}
          <span aria-live="polite">
            {value.length} / {maxLength}
          </span>
        </p>
      )}
    </FieldShell>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  ...base
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <FieldShell {...base} id={id} hintId={hintId} errorId={errorId}>
      <select
        id={id}
        name={base.name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-required={base.required}
        aria-invalid={Boolean(base.error)}
        aria-describedby={
          [base.hint ? hintId : null, base.error ? errorId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        className={`${inputClass} h-12`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

/** Comma-separated free text, kept as a list. */
export function ListField({
  value,
  onChange,
  placeholder,
  ...base
}: BaseProps & {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  return (
    <TextField
      {...base}
      value={value.join(', ')}
      onChange={(raw) =>
        onChange(
          raw
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 10),
        )
      }
      placeholder={placeholder}
    />
  );
}
