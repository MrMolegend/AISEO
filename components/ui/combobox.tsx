'use client';
import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Shown right-aligned: a region for a country, nothing for a currency. */
  note?: string;
}

/**
 * A searchable single-select.
 *
 * Two hundred countries is too many for a `<select>` on a phone and far too
 * many for one on a desktop, so this is the ARIA 1.2 combobox pattern with a
 * filtered listbox: type to narrow, arrow to move, Enter to choose, Escape to
 * close. `aria-activedescendant` keeps DOM focus in the input while the visual
 * selection moves through the list, which is what lets a screen-reader user
 * hear each option without losing their place in the text they are typing.
 *
 * Committing is deliberately strict. The value is an ISO code and the label is
 * a display string; a half-typed name that never matched an option leaves the
 * field empty rather than storing "Unite", because a report keyed to a market
 * that does not exist is worse than a validation error.
 */
export function Combobox({
  label,
  name,
  hint,
  options,
  value,
  onChange,
  placeholder,
  required,
  error,
  emptyMessage = 'No matches',
}: {
  label: string;
  name: string;
  hint?: string;
  options: readonly ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  emptyMessage?: string;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const listId = `${id}-list`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const selected = options.find((option) => option.value === value) ?? null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const needle = query.trim().toLowerCase();
  const matches = (
    needle.length === 0
      ? options
      : options.filter(
          (option) =>
            option.value.toLowerCase() === needle ||
            option.label.toLowerCase().startsWith(needle) ||
            option.label
              .toLowerCase()
              .split(/[\s(\-']+/)
              .some((word) => word.startsWith(needle)),
        )
  ).slice(0, 40);

  function commit(option: ComboboxOption): void {
    onChange(option.value);
    setQuery('');
    setOpen(false);
    setActive(0);
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-text mb-2 block text-[13px] font-medium">
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

      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches.length > 0 ? `${listId}-${active}` : undefined
          }
          aria-required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={
            [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
            undefined
          }
          autoComplete="off"
          /* The selected label sits in the field when closed, so the control
             reads as "United Arab Emirates" rather than as an empty box with a
             value hidden somewhere else. */
          value={open ? query : (selected?.label ?? '')}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) {
                setOpen(true);
                return;
              }
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setActive((current) => {
                if (matches.length === 0) return 0;
                return (current + step + matches.length) % matches.length;
              });
              return;
            }
            if (event.key === 'Enter' && open) {
              const option = matches[active];
              if (option) {
                event.preventDefault();
                commit(option);
              }
              return;
            }
            if (event.key === 'Escape') {
              setOpen(false);
              setQuery('');
              return;
            }
            if (event.key === 'Tab') setOpen(false);
          }}
          onBlur={() => {
            // A click on an option blurs the input before the click lands, so
            // closing is deferred by a tick rather than done immediately.
            blurTimer.current = setTimeout(() => {
              setOpen(false);
              setQuery('');
            }, 120);
          }}
          className={cn(
            'border-rule-strong bg-ground-raised text-text placeholder:text-text-faint h-12 w-full border px-3.5 text-[15px] transition-colors',
            'focus:border-cobalt outline-none',
            error && 'border-copper',
          )}
        />

        {/* Kept in the DOM so the value posts with a plain form submission. */}
        <input type="hidden" name={name} value={value ?? ''} />

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className="border-rule-strong bg-ground-raised absolute z-[50] mt-1 max-h-72 w-full overflow-y-auto border shadow-[var(--shadow-lift)]"
          >
            {matches.length === 0 && (
              <li className="text-text-faint px-3.5 py-3 text-[14px]">{emptyMessage}</li>
            )}
            {matches.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                onMouseDown={(event) => {
                  // mousedown, not click: click fires after blur has closed us.
                  event.preventDefault();
                  if (blurTimer.current) clearTimeout(blurTimer.current);
                  commit(option);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  'flex cursor-pointer items-baseline justify-between gap-3 px-3.5 py-2.5 text-[14px]',
                  index === active ? 'bg-cobalt-surface text-text' : 'text-text-muted',
                )}
              >
                <span>{option.label}</span>
                {option.note && (
                  <span className="meta text-text-faint">{option.note}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {hint && (
        <p id={hintId} className="text-text-subtle mt-1.5 text-[13px] leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-copper mt-1.5 text-[13px]">
          {error}
        </p>
      )}
    </div>
  );
}
