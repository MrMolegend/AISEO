'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';

/**
 * The score, decomposed.
 *
 * The total is never shown without its working: every dimension renders
 * its raw signal, weight, contribution and one-sentence explanation, and
 * missing inputs are named rather than hidden. An override displays beside
 * the computed number with who and why — it replaces the headline, never
 * the arithmetic.
 */

export interface ScoreComponentView {
  dimension: string;
  label: string;
  raw: number;
  weight: number;
  explanation: string;
  missing: boolean;
  missingInputs: string[];
}

export interface ScoreView {
  total: number;
  components: ScoreComponentView[];
  computedAt: string;
  overrideTotal: number | null;
  overrideReason: string | null;
}

export interface MatchView {
  brandId: string;
  brandName: string;
  verdict: string;
  explanation: string;
}

const VERDICT_LABEL: Record<string, string> = {
  already_stocked: 'Already stocked',
  observed_opportunity: 'Observed opportunity',
  not_verified: 'Not verified',
  restricted: 'Restricted — never suggested',
};

export function ScorePanel({
  accountId,
  score,
  matches,
  canOverride,
}: {
  accountId: string;
  score: ScoreView | null;
  matches: MatchView[];
  canOverride: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  async function recompute() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/leads/${accountId}/score`, { method: 'POST' });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFailure(payload?.message ?? 'The score could not be recomputed.');
        return;
      }
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function patch(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(`/api/leads/${accountId}/score`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setFailure(payload?.message ?? 'The override could not be saved.');
        return;
      }
      setOverrideValue('');
      setOverrideReason('');
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="score-heading">
      <Rule label="Score" className="mt-12" />
      {!score ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <p id="score-heading" className="text-text-muted text-[14px]">
            No score computed yet.
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void recompute()}
          >
            Compute the score
          </Button>
        </div>
      ) : (
        <Panel className="mt-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p id="score-heading" className="text-text-subtle text-[12px]">
                {score.overrideTotal !== null ? 'Manager override' : 'Computed score'}
              </p>
              <p className="text-text text-4xl font-medium" data-numeric>
                {score.overrideTotal ?? score.total}
                <span className="text-text-subtle text-lg"> / 100</span>
              </p>
              {score.overrideTotal !== null && (
                <p className="text-text-subtle mt-1 text-[13px]" data-numeric>
                  Arithmetic said {score.total}. Reason: {score.overrideReason}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Meta data-numeric>Computed {score.computedAt.slice(0, 10)}</Meta>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void recompute()}
              >
                Recompute
              </Button>
            </div>
          </div>

          <ul className="mt-6 space-y-3">
            {score.components.map((component, index) => (
              <li key={component.dimension}>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-text text-[13px] font-medium">
                    {component.label}
                    {component.missing && (
                      <span className="text-copper font-normal"> — missing input</span>
                    )}
                  </span>
                  <span className="text-text-muted text-[12px]" data-numeric>
                    {component.raw} × weight {component.weight}
                  </span>
                </div>
                <div
                  className="bg-ground-sunken mt-1 h-1.5 w-full"
                  role="img"
                  aria-label={`${component.label}: ${component.raw} out of 100`}
                >
                  <div
                    className="bg-signal animate-bar h-full"
                    style={
                      {
                        width: `${component.raw}%`,
                        '--bar-index': index,
                      } as React.CSSProperties
                    }
                  />
                </div>
                <p className="text-text-subtle mt-1 text-[12px] leading-relaxed">
                  {component.explanation}
                  {component.missingInputs.length > 0 &&
                    ` Missing: ${component.missingInputs.join(', ')}.`}
                </p>
              </li>
            ))}
          </ul>

          {canOverride && (
            <div className="border-rule mt-6 border-t pt-5">
              {score.overrideTotal !== null ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void patch({ clearOverride: true })}
                >
                  Remove the override
                </Button>
              ) : (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const total = Number(overrideValue);
                    if (!Number.isInteger(total) || total < 0 || total > 100) {
                      setFailure('The override must be a whole number from 0 to 100.');
                      return;
                    }
                    if (!overrideReason.trim()) {
                      setFailure('An override needs its reason.');
                      return;
                    }
                    void patch({ overrideTotal: total, reason: overrideReason });
                  }}
                >
                  <div>
                    <label
                      htmlFor="override-total"
                      className="text-text mb-2 block text-[13px] font-medium"
                    >
                      Override score
                    </label>
                    <input
                      id="override-total"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100}
                      value={overrideValue}
                      onChange={(event) => setOverrideValue(event.target.value)}
                      className="border-rule-strong bg-ground-raised text-text w-24 border px-3 py-2 text-[14px]"
                    />
                  </div>
                  <div className="min-w-0 flex-1 sm:max-w-md">
                    <label
                      htmlFor="override-reason"
                      className="text-text mb-2 block text-[13px] font-medium"
                    >
                      Why
                    </label>
                    <input
                      id="override-reason"
                      value={overrideReason}
                      onChange={(event) => setOverrideReason(event.target.value)}
                      maxLength={500}
                      className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2 text-[14px]"
                      placeholder="What you know that the arithmetic does not"
                    />
                  </div>
                  <Button type="submit" variant="secondary" size="sm" disabled={busy}>
                    Save override
                  </Button>
                </form>
              )}
            </div>
          )}
        </Panel>
      )}

      {matches.length > 0 && (
        <>
          <Rule label="Catalogue match" className="mt-10" />
          <ul className="border-rule divide-rule mt-4 divide-y border">
            {matches.map((match) => (
              <li key={match.brandId} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <span className="text-text text-[14px] font-medium">
                    {match.brandName}
                  </span>
                  <span className="text-text-muted text-[12px] tracking-wide uppercase">
                    {VERDICT_LABEL[match.verdict] ?? match.verdict}
                  </span>
                </div>
                <p className="text-text-subtle mt-1 text-[13px] leading-relaxed">
                  {match.explanation}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {failure && (
        <p role="alert" className="text-copper mt-3 text-[13px]">
          {failure}
        </p>
      )}
    </section>
  );
}
