'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Meta } from '@/components/ui/panel';

/**
 * Lightweight report feedback.
 *
 * One question, one optional sentence, revisable — an instrument panel, not
 * a survey. The stored verdict is the customer's alone; only anonymous
 * aggregates reach the operations console.
 */

const CATEGORIES = [
  { value: 'accuracy', label: 'Accuracy' },
  { value: 'evidence', label: 'Evidence' },
  { value: 'depth', label: 'Depth' },
  { value: 'clarity', label: 'Clarity' },
  { value: 'actionability', label: 'Actionability' },
  { value: 'other', label: 'Something else' },
] as const;

export function FeedbackControl({
  publicId,
  initial,
}: {
  publicId: string;
  initial: { useful: boolean; category: string | null; comment: string | null } | null;
}) {
  const [useful, setUseful] = useState<boolean | null>(initial?.useful ?? null);
  const [category, setCategory] = useState<string | null>(initial?.category ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>(
    initial ? 'saved' : 'idle',
  );

  async function save(nextUseful: boolean) {
    setUseful(nextUseful);
    setExpanded(true);
    await submit(nextUseful, category, comment);
  }

  async function submit(
    value: boolean,
    nextCategory: string | null,
    nextComment: string,
  ) {
    setState('saving');
    try {
      const response = await fetch(`/api/research/${publicId}/feedback`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          useful: value,
          category: nextCategory,
          comment: nextComment.trim() || null,
        }),
      });
      setState(response.ok ? 'saved' : 'failed');
    } catch {
      setState('failed');
    }
  }

  return (
    <section
      aria-labelledby="feedback-heading"
      className="border-rule mt-4 border-t pt-6 print:hidden"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="feedback-heading" className="text-text text-[14px] font-medium">
          Was this report useful?
        </h2>
        <Button
          variant={useful === true ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={useful === true}
          onClick={() => void save(true)}
        >
          Useful
        </Button>
        <Button
          variant={useful === false ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={useful === false}
          onClick={() => void save(false)}
        >
          Not useful
        </Button>
        <span role="status" className="text-text-faint text-[12px]">
          {state === 'saving' && 'Saving…'}
          {state === 'saved' && 'Noted — you can change this any time.'}
          {state === 'failed' && 'That did not save. Try again.'}
        </span>
      </div>

      {(expanded || initial) && useful !== null && (
        <div className="mt-4 max-w-[560px]">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((entry) => (
              <button
                key={entry.value}
                type="button"
                aria-pressed={category === entry.value}
                onClick={() => {
                  const next = category === entry.value ? null : entry.value;
                  setCategory(next);
                  void submit(useful, next, comment);
                }}
                className={
                  category === entry.value
                    ? 'border-signal bg-signal-surface text-text border px-2 py-1 text-[12px]'
                    : 'border-rule text-text-muted hover:border-rule-strong border px-2 py-1 text-[12px] transition-colors'
                }
              >
                {entry.label}
              </button>
            ))}
          </div>
          <label htmlFor="feedback-comment" className="sr-only">
            Tell us more
          </label>
          <textarea
            id="feedback-comment"
            rows={2}
            maxLength={2000}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            onBlur={() => useful !== null && void submit(useful, category, comment)}
            placeholder="Anything specific? Entirely optional."
            className="border-rule-strong bg-ground-raised text-text placeholder:text-text-faint mt-3 w-full border px-3 py-2 text-[13px]"
          />
          <Meta className="mt-1 block">
            Feedback is private to you and the operators; it never appears to other
            customers.
          </Meta>
        </div>
      )}
    </section>
  );
}
