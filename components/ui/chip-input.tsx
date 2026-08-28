'use client';
import { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * A list of short names, entered one at a time.
 *
 * The previous version of this control was a text field that split on commas,
 * which broke the moment someone typed a company name containing one — and, far
 * more often, silently ate the last entry because the user did not type a
 * trailing comma before submitting. This one commits on Enter, on comma, and on
 * blur, so a half-typed name is never lost by moving to the next field.
 *
 * Spaces are ordinary characters. That sounds obvious and is the single most
 * common defect in chip inputs: splitting on whitespace makes "Halen Môn" two
 * competitors.
 *
 * Accessibility, in order of how easily each is got wrong:
 *
 *   · Each chip's remove control is a real button with its own name — "Remove
 *     Maldon Salt" — not an × that a screen reader announces as "button".
 *   · Backspace on an empty field removes the last chip, which is what
 *     keyboard users reach for, and the removal is announced.
 *   · Additions, rejections and removals all go through one polite live region.
 *     A duplicate that silently does nothing is indistinguishable from a broken
 *     control.
 *   · The wrapper is styled to look like a field, but the real input keeps
 *     focus, so the focus ring lands where typing goes.
 */
export function ChipInput({
  label,
  name,
  hint,
  value,
  onChange,
  max = 10,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  hint?: string;
  value: string[];
  onChange: (value: string[]) => void;
  max?: number;
  placeholder?: string;
  error?: string;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const countId = `${id}-count`;
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const full = value.length >= max;

  function add(raw: string): void {
    // One paste can contain a whole list; commas and newlines both separate.
    const candidates = raw
      .split(/[,\n\r]+/)
      .map((item) => item.trim().replace(/\s+/g, ' '))
      .filter((item) => item.length > 0);

    if (candidates.length === 0) return;

    const next = [...value];
    const seen = new Set(next.map((item) => item.toLowerCase()));
    const added: string[] = [];
    let duplicates = 0;
    let overflowed = false;

    for (const candidate of candidates) {
      if (next.length >= max) {
        overflowed = true;
        break;
      }
      const key = candidate.toLowerCase();
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      next.push(candidate.slice(0, 120));
      added.push(candidate);
    }

    if (added.length > 0) onChange(next);

    const parts: string[] = [];
    if (added.length > 0) parts.push(`Added ${added.join(', ')}.`);
    if (duplicates > 0) {
      parts.push(
        `${duplicates === 1 ? 'One entry was' : `${duplicates} entries were`} already in the list.`,
      );
    }
    if (overflowed) parts.push(`The list is limited to ${max}.`);
    setAnnouncement(parts.join(' '));
    setDraft('');
  }

  function remove(index: number): void {
    const removed = value[index];
    onChange(value.filter((_, position) => position !== index));
    setAnnouncement(removed ? `Removed ${removed}.` : 'Removed.');
    inputRef.current?.focus();
  }

  return (
    <div>
      <label htmlFor={inputId} className="text-text mb-2 block text-[13px] font-medium">
        {label}
        <span className="text-text-faint font-normal"> (optional)</span>
      </label>

      {/*
       * Clicking the padding should focus the field, the way it does on a real
       * input. It is a div rather than a fieldset because the chips are not
       * form controls — they are the field's current value.
       */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'border-rule-strong bg-ground-raised focus-within:border-cobalt flex flex-wrap items-center gap-2 border p-2 transition-colors',
          error && 'border-copper',
        )}
      >
        {value.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {value.map((entry, index) => (
              <li
                key={`${entry}-${index}`}
                className="border-rule bg-ground-sunken text-text flex items-center gap-1.5 border py-1 pr-1 pl-2.5 text-[13px]"
              >
                <span className="max-w-[22ch] truncate">{entry}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${entry}`}
                  /* 28px, which is the smallest a destructive control gets to
                     be next to a 44px row on a phone. */
                  className="text-text-faint hover:text-copper flex h-7 w-7 shrink-0 items-center justify-center transition-colors"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          autoComplete="off"
          value={draft}
          disabled={full}
          placeholder={full ? `Limit of ${max} reached` : placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              // Enter must not submit the stage; a comma must not be typed.
              event.preventDefault();
              add(draft);
              return;
            }
            if (event.key === 'Backspace' && draft.length === 0 && value.length > 0) {
              event.preventDefault();
              remove(value.length - 1);
            }
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData('text');
            if (!/[,\n\r]/.test(text)) return;
            event.preventDefault();
            add(text);
          }}
          /* The draft is committed rather than discarded. Losing what someone
             just typed because they tabbed onward is the defect this control
             exists to avoid. */
          onBlur={() => add(draft)}
          aria-describedby={
            [hint ? hintId : null, countId, error ? errorId : null]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-invalid={Boolean(error)}
          className="text-text placeholder:text-text-faint min-w-[14ch] flex-1 bg-transparent px-1.5 py-1.5 text-[15px] outline-none disabled:cursor-not-allowed"
        />
      </div>

      {hint && (
        <p id={hintId} className="text-text-subtle mt-1.5 text-[13px] leading-relaxed">
          {hint}
        </p>
      )}
      <p id={countId} className="text-text-faint mt-1 text-[12px]">
        {value.length} of {max}. Press Enter or a comma after each one.
      </p>
      {error && (
        <p id={errorId} role="alert" className="text-copper mt-1.5 text-[13px]">
          {error}
        </p>
      )}

      {/* One region for every outcome, so a rejected duplicate is not silence. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
