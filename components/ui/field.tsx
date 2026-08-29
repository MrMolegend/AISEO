'use client';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Form fields.
 *
 * Every field labels itself, describes itself, and announces its own errors.
 * That is not decoration: this intake is four stages long, and someone filling
 * it in on a phone with a screen reader needs to know which field is required
 * and why one was rejected without hunting for an outline they cannot see.
 *
 * Inputs are 16px minimum. Below that, iOS zooms the whole page on focus and
 * the user pinches back out for every field.
 */

interface BaseProps {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

const controlClass =
  'border-rule-strong bg-ground-raised text-text placeholder:text-text-faint w-full border px-3.5 transition-colors focus:border-cobalt outline-none aria-[invalid=true]:border-copper';

function Label({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="text-text mb-2 block text-[13px] font-medium">
      {label}
      {required ? (
        <span className="text-copper" aria-hidden="true">
          {' '}
          *
        </span>
      ) : (
        <span className="text-text-faint font-normal"> (optional)</span>
      )}
    </label>
  );
}

function Support({
  hint,
  hintId,
  error,
  errorId,
  example,
}: {
  hint?: string;
  hintId: string;
  error?: string;
  errorId: string;
  example?: string;
}) {
  return (
    <>
      {hint && (
        <p id={hintId} className="text-text-subtle mt-1.5 text-[13px] leading-relaxed">
          {hint}
        </p>
      )}
      {/* A worked example does more than an instruction. Marked as an example
          rather than as a placeholder so it survives typing. */}
      {example && (
        <p className="text-text-faint mt-1 text-[12px] leading-relaxed italic">
          For example: {example}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-copper mt-1.5 text-[13px]">
          {error}
        </p>
      )}
    </>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  inputMode,
  example,
  ...base
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
  example?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div>
      <Label htmlFor={id} label={base.label} required={base.required} />
      <input
        id={id}
        name={base.name}
        type="text"
        inputMode={inputMode}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-required={base.required}
        aria-invalid={Boolean(base.error)}
        aria-describedby={
          [base.hint ? hintId : null, base.error ? errorId : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        className={cn(controlClass, 'h-12 text-[15px]')}
      />
      <Support
        hint={base.hint}
        hintId={hintId}
        error={base.error}
        errorId={errorId}
        example={example}
      />
    </div>
  );
}

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  example,
  ...base
}: BaseProps & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  example?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;

  return (
    <div>
      <Label htmlFor={id} label={base.label} required={base.required} />
      <textarea
        id={id}
        name={base.name}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
        className={cn(controlClass, 'resize-y py-3 text-[15px] leading-relaxed')}
      />
      {maxLength && (
        <p
          id={counterId}
          className="text-text-faint mt-1 text-right text-[11px]"
          data-numeric
        >
          {/* Live, so someone who cannot see the counter hears it as they
              approach the limit rather than discovering it on submit. */}
          <span aria-live="polite">
            {value.length} / {maxLength}
          </span>
        </p>
      )}
      <Support
        hint={base.hint}
        hintId={hintId}
        error={base.error}
        errorId={errorId}
        example={example}
      />
    </div>
  );
}

/**
 * A single choice among a handful of named options.
 *
 * A radio group rather than a select, because the options are the substance of
 * the question — "wholesale, retail, ecommerce, direct, distributor, mixed" is
 * information the customer needs to see to answer well, and collapsing it into
 * a closed dropdown hides the thing they are being asked to think about.
 *
 * Real radio inputs, visually hidden, so arrow-key navigation, grouping and
 * announcement all come from the browser rather than from an approximation.
 */
export function RadioCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
  ...base
}: Omit<BaseProps, 'label'> & {
  label: string;
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: string; description?: string }>;
  columns?: 1 | 2 | 3;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <fieldset
      aria-describedby={
        [base.hint ? hintId : null, base.error ? errorId : null]
          .filter(Boolean)
          .join(' ') || undefined
      }
    >
      <legend className="text-text mb-2 text-[13px] font-medium">
        {base.label}
        {base.required ? (
          <span className="text-copper" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </legend>

      <div
        className={cn(
          'grid gap-2',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-3',
        )}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer flex-col gap-1 border p-3 transition-colors',
                'has-[:focus-visible]:outline-cobalt has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
                selected
                  ? 'border-signal bg-signal-surface'
                  : 'border-rule bg-ground-raised hover:border-rule-strong',
              )}
            >
              <input
                type="radio"
                name={base.name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                className={cn(
                  'text-[14px] font-medium',
                  selected ? 'text-signal' : 'text-text',
                )}
              >
                {option.label}
              </span>
              {option.description && (
                <span className="text-text-subtle text-[12px] leading-relaxed">
                  {option.description}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <Support hint={base.hint} hintId={hintId} error={base.error} errorId={errorId} />
    </fieldset>
  );
}
