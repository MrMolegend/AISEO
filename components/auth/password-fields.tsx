'use client';
import { useId, useState } from 'react';

/**
 * Password entry, with confirmation.
 *
 * Three deliberate choices:
 *
 * The requirements are stated *before* anyone types, not revealed as errors
 * afterwards. A rule you only learn by breaking it is a rule you resent.
 *
 * Show/hide is a real button in the tab order with a live-updating accessible
 * name, not an eye glyph with a tooltip. On a phone, being able to see what you
 * typed is the difference between a password you chose and one you gave up on.
 *
 * The mismatch check runs on blur rather than on every keystroke, so it does
 * not shout "does not match" at someone who has typed one character of the
 * second field.
 */

/** Supabase's own default floor. Raising it here would only mislead. */
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordState {
  password: string;
  confirm: string;
}

export function passwordProblem(state: PasswordState): string | null {
  if (state.password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (state.confirm.length > 0 && state.password !== state.confirm) {
    return 'Those passwords do not match.';
  }
  return null;
}

export function PasswordFields({
  value,
  onChange,
  disabled,
  autoComplete = 'new-password',
}: {
  value: PasswordState;
  onChange: (next: PasswordState) => void;
  disabled?: boolean;
  autoComplete?: 'new-password' | 'current-password';
}) {
  const [visible, setVisible] = useState(false);
  const [touched, setTouched] = useState(false);
  const passwordId = useId();
  const confirmId = useId();
  const rulesId = useId();
  const errorId = useId();

  const mismatch =
    touched && value.confirm.length > 0 && value.password !== value.confirm;
  const tooShort =
    touched && value.password.length > 0 && value.password.length < MIN_PASSWORD_LENGTH;
  const problem = mismatch
    ? 'Those passwords do not match.'
    : tooShort
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : null;

  const field =
    'border-line-strong bg-surface text-ink placeholder:text-ink-faint focus:border-brand focus-visible:ring-brand h-12 w-full rounded-[var(--radius-control)] border px-3.5 text-base transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60';

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label htmlFor={passwordId} className="text-ink block text-sm font-medium">
            Password
          </label>
          <button
            type="button"
            onClick={() => setVisible((shown) => !shown)}
            className="text-ink-subtle hover:text-ink focus-visible:ring-brand rounded text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {visible ? 'Hide' : 'Show'}
            <span className="sr-only"> password</span>
          </button>
        </div>
        <input
          id={passwordId}
          name="password"
          type={visible ? 'text' : 'password'}
          value={value.password}
          onChange={(event) => onChange({ ...value, password: event.target.value })}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          required
          autoComplete={autoComplete}
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby={problem ? errorId : rulesId}
          aria-invalid={problem !== null}
          className={field}
        />
        <p id={rulesId} className="text-ink-subtle mt-1.5 text-xs leading-relaxed">
          At least {MIN_PASSWORD_LENGTH} characters. A short phrase you will remember
          beats a short word with symbols in it.
        </p>
      </div>

      <div>
        <label htmlFor={confirmId} className="text-ink mb-1.5 block text-sm font-medium">
          Confirm password
        </label>
        <input
          id={confirmId}
          name="confirmPassword"
          type={visible ? 'text' : 'password'}
          value={value.confirm}
          onChange={(event) => onChange({ ...value, confirm: event.target.value })}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          required
          autoComplete={autoComplete}
          aria-describedby={problem ? errorId : undefined}
          aria-invalid={problem !== null}
          className={field}
        />
      </div>

      {/* Always present, so a screen reader announces the change rather than
          the arrival of a new node. */}
      <p
        id={errorId}
        role="alert"
        aria-live="assertive"
        className="text-sm text-[var(--color-severity-critical)]"
      >
        {problem}
      </p>
    </div>
  );
}
