import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Horizontal progress through a multi-step form. On narrow screens the labels
 * collapse to "Step 2 of 6 · Choose a time" so the row never wraps into a mess.
 */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-ink-subtle text-sm lg:hidden">
        Step {current + 1} of {steps.length} ·{' '}
        <span className="text-ink font-medium">{steps[current]}</span>
      </p>

      <ol className="hidden items-center gap-2 lg:flex">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li key={step} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                  done && 'border-success bg-success dark:text-ink-inverse text-white',
                  active && 'border-brand bg-brand text-on-brand',
                  !done && !active && 'border-line-strong text-ink-subtle',
                )}
              >
                {done ? <Check className="size-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  active ? 'text-ink font-medium' : 'text-ink-subtle',
                )}
              >
                {step}
              </span>
              {index < steps.length - 1 && (
                <span
                  className={cn(
                    'ml-1 h-px flex-1',
                    done ? 'bg-success' : 'bg-line-strong',
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        Step {current + 1} of {steps.length}: {steps[current]}
      </p>
    </div>
  );
}
