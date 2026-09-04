'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextAreaField } from '@/components/ui/field';
import {
  SCORE_DIMENSIONS,
  SCORE_DIMENSION_LABEL,
  type FACT_SOURCES,
  type ScoringWeights,
} from '@/schemas/alt-config';

/**
 * The keyed commercial configuration, edited in place.
 *
 * Each section saves its own key, so a weights tweak never rides along with
 * a half-edited proof point. Facts carry their source and date visibly —
 * the point of the exercise is that outreach later refuses to lean on an
 * unsourced claim.
 */

export interface ProofPoint {
  text: string;
  source: (typeof FACT_SOURCES)[number];
  recordedOn: string;
}

export interface ProhibitedClaim {
  text: string;
  reason: string;
}

export interface OutreachRules {
  tone: string;
  signature: string;
  disclaimer: string;
  languages: ('en' | 'ar')[];
}

export interface BudgetCaps {
  perCampaignUnits: number;
  perDayUnits: number;
}

const SOURCE_LABEL: Record<ProofPoint['source'], string> = {
  alt_admin: 'ALT administrator',
  build_specification: 'Build specification',
  official_website: 'Official website',
  official_linkedin: 'Official LinkedIn',
};

async function saveKey(key: string, value: unknown): Promise<string | null> {
  try {
    const response = await fetch('/api/commercial/config', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return (
        payload?.issues?.[0]?.message ?? payload?.message ?? 'The change was not saved.'
      );
    }
    return null;
  } catch {
    return 'We could not reach the server. Try again.';
  }
}

function SectionStatus({ state }: { state: 'idle' | 'saving' | 'saved' | string }) {
  if (state === 'idle') return null;
  if (state === 'saving') return <Meta role="status">Saving…</Meta>;
  if (state === 'saved') return <Meta role="status">Saved</Meta>;
  return (
    <p role="alert" className="text-copper text-[13px]">
      {state}
    </p>
  );
}

/* ── Proof points ─────────────────────────────────────────────────────────── */

export function ProofPointsEditor({ initial }: { initial: ProofPoint[] }) {
  const [points, setPoints] = useState(initial);
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<string>('idle');

  async function persist(next: ProofPoint[]) {
    setPoints(next);
    setState('saving');
    const failure = await saveKey('proof_points', next);
    setState(failure ?? 'saved');
  }

  return (
    <section aria-labelledby="proof-points-heading">
      <Rule label="Approved proof points" className="mt-12" />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p id="proof-points-heading" className="text-text-muted text-[13px]">
          The claims outreach may ground itself in. Each carries its source and the date
          it was recorded; time-sensitive numbers need re-checking.
        </p>
        <SectionStatus state={state} />
      </div>

      <ul className="border-rule divide-rule mt-4 divide-y border">
        {points.map((point, index) => (
          <li
            key={`${point.text.slice(0, 40)}-${index}`}
            className="flex items-start justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="text-text text-[14px] leading-relaxed">{point.text}</p>
              <p className="text-text-subtle mt-1 text-[12px]">
                {SOURCE_LABEL[point.source]} · recorded {point.recordedOn}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void persist(points.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </li>
        ))}
        {points.length === 0 && (
          <li className="text-text-muted px-4 py-6 text-center text-[13px]">
            No approved proof points. Outreach drafts will carry no company claims until
            some exist.
          </li>
        )}
      </ul>

      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft('');
          void persist([
            ...points,
            {
              text,
              source: 'alt_admin',
              recordedOn: new Date().toISOString().slice(0, 10),
            },
          ]);
        }}
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="new-proof-point"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Add a proof point
          </label>
          <input
            id="new-proof-point"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={300}
            className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
            placeholder="A claim ALT can stand behind, in one sentence"
          />
        </div>
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>
    </section>
  );
}

/* ── Prohibited claims ────────────────────────────────────────────────────── */

export function ProhibitedClaimsEditor({ initial }: { initial: ProhibitedClaim[] }) {
  const [claims, setClaims] = useState(initial);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [state, setState] = useState<string>('idle');

  async function persist(next: ProhibitedClaim[]) {
    setClaims(next);
    setState('saving');
    const failure = await saveKey('prohibited_claims', next);
    setState(failure ?? 'saved');
  }

  return (
    <section aria-labelledby="prohibited-heading">
      <Rule label="Prohibited or expired claims" className="mt-12" />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p id="prohibited-heading" className="text-text-muted text-[13px]">
          Claims outreach must never make — expired exclusivities, retired numbers,
          anything legal has ruled out.
        </p>
        <SectionStatus state={state} />
      </div>

      <ul className="border-rule divide-rule mt-4 divide-y border">
        {claims.map((claim, index) => (
          <li
            key={`${claim.text.slice(0, 40)}-${index}`}
            className="flex items-start justify-between gap-4 px-4 py-3"
          >
            <div>
              <p className="text-text text-[14px] leading-relaxed">{claim.text}</p>
              {claim.reason && (
                <p className="text-text-subtle mt-1 text-[12px]">{claim.reason}</p>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void persist(claims.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </li>
        ))}
        {claims.length === 0 && (
          <li className="text-text-muted px-4 py-6 text-center text-[13px]">
            Nothing prohibited yet.
          </li>
        )}
      </ul>

      <form
        className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = text.trim();
          if (!trimmed) return;
          setText('');
          setReason('');
          void persist([...claims, { text: trimmed, reason: reason.trim() }]);
        }}
      >
        <div>
          <label
            htmlFor="new-prohibited"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Claim to prohibit
          </label>
          <input
            id="new-prohibited"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={300}
            className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
          />
        </div>
        <div>
          <label
            htmlFor="new-prohibited-reason"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Why (optional)
          </label>
          <input
            id="new-prohibited-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
          />
        </div>
        <Button type="submit" variant="secondary">
          Add
        </Button>
      </form>
    </section>
  );
}

/* ── Outreach rules ───────────────────────────────────────────────────────── */

export function OutreachRulesEditor({ initial }: { initial: OutreachRules }) {
  const [rules, setRules] = useState(initial);
  const [state, setState] = useState<string>('idle');

  return (
    <section aria-labelledby="outreach-rules-heading">
      <Rule label="Outreach tone and signature" className="mt-12" />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p id="outreach-rules-heading" className="text-text-muted text-[13px]">
          Applied to every generated draft. Languages control which variants the studio
          offers.
        </p>
        <SectionStatus state={state} />
      </div>

      <form
        className="mt-4 max-w-2xl space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          setState('saving');
          void saveKey('outreach_rules', rules).then((failure) =>
            setState(failure ?? 'saved'),
          );
        }}
      >
        <TextAreaField
          label="Tone"
          name="tone"
          rows={2}
          value={rules.tone}
          onChange={(tone) => setRules({ ...rules, tone })}
          hint="How ALT sounds: direct, warm, trade-professional…"
        />
        <TextAreaField
          label="Signature block"
          name="signature"
          rows={2}
          value={rules.signature}
          onChange={(signature) => setRules({ ...rules, signature })}
        />
        <TextAreaField
          label="Disclaimer"
          name="disclaimer"
          rows={2}
          value={rules.disclaimer}
          onChange={(disclaimer) => setRules({ ...rules, disclaimer })}
        />
        <fieldset>
          <legend className="text-text text-[13px] font-medium">Languages</legend>
          <div className="mt-2 flex gap-6">
            {(['en', 'ar'] as const).map((language) => (
              <label key={language} className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={rules.languages.includes(language)}
                  onChange={() => {
                    const has = rules.languages.includes(language);
                    const next = has
                      ? rules.languages.filter((l) => l !== language)
                      : [...rules.languages, language];
                    if (next.length === 0) return;
                    setRules({ ...rules, languages: next });
                  }}
                  className="accent-[var(--color-signal)]"
                />
                <span className="text-text-muted text-[13px]">
                  {language === 'en' ? 'English' : 'Arabic'}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" variant="secondary">
          Save outreach rules
        </Button>
      </form>
    </section>
  );
}

/* ── Scoring weights ──────────────────────────────────────────────────────── */

export function ScoringWeightsEditor({ initial }: { initial: ScoringWeights }) {
  const [weights, setWeights] = useState(initial);
  const [state, setState] = useState<string>('idle');
  const total = SCORE_DIMENSIONS.reduce((sum, d) => sum + (weights[d] || 0), 0);

  return (
    <section aria-labelledby="weights-heading">
      <Rule label="Scoring weights" className="mt-12" />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p id="weights-heading" className="text-text-muted text-[13px]">
          Relative importance, 0–100 each; scores normalise against the total. The
          arithmetic is deterministic and every score shows its working.
        </p>
        <SectionStatus state={state} />
      </div>

      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          setState('saving');
          void saveKey('scoring_weights', weights).then((failure) =>
            setState(failure ?? 'saved'),
          );
        }}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {SCORE_DIMENSIONS.map((dimension) => (
            <div key={dimension} className="flex items-center justify-between gap-4">
              <label htmlFor={`weight-${dimension}`} className="text-text text-[13px]">
                {SCORE_DIMENSION_LABEL[dimension]}
              </label>
              <input
                id={`weight-${dimension}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={weights[dimension]}
                onChange={(event) =>
                  setWeights({
                    ...weights,
                    [dimension]: Math.max(
                      0,
                      Math.min(100, Math.trunc(event.target.valueAsNumber || 0)),
                    ),
                  })
                }
                className="border-rule-strong bg-ground-raised text-text w-20 border px-2 py-1.5 text-right text-[13px]"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Button type="submit" variant="secondary">
            Save weights
          </Button>
          <Meta data-numeric>Total weight {total}</Meta>
        </div>
      </form>
    </section>
  );
}

/* ── Budget caps ──────────────────────────────────────────────────────────── */

export function BudgetCapsEditor({ initial }: { initial: BudgetCaps }) {
  const [caps, setCaps] = useState(initial);
  const [state, setState] = useState<string>('idle');

  return (
    <section aria-labelledby="caps-heading">
      <Rule label="Research budget caps" className="mt-12" />
      <div className="mt-2 flex items-center justify-between gap-4">
        <p id="caps-heading" className="text-text-muted text-[13px]">
          Hard ceilings on provider usage. A campaign preview must fit the per-campaign
          cap before it can start; the daily cap protects the workspace as a whole.
        </p>
        <SectionStatus state={state} />
      </div>

      <form
        className="mt-4 flex flex-wrap items-end gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          setState('saving');
          void saveKey('budget_caps', caps).then((failure) =>
            setState(failure ?? 'saved'),
          );
        }}
      >
        <div>
          <label
            htmlFor="cap-campaign"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Per campaign (units)
          </label>
          <input
            id="cap-campaign"
            type="number"
            inputMode="numeric"
            min={1}
            max={2000}
            value={caps.perCampaignUnits}
            onChange={(event) =>
              setCaps({
                ...caps,
                perCampaignUnits: Math.trunc(event.target.valueAsNumber || 1),
              })
            }
            className="border-rule-strong bg-ground-raised text-text w-32 border px-3 py-2.5 text-[14px]"
          />
        </div>
        <div>
          <label
            htmlFor="cap-day"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Per day, workspace-wide (units)
          </label>
          <input
            id="cap-day"
            type="number"
            inputMode="numeric"
            min={1}
            max={5000}
            value={caps.perDayUnits}
            onChange={(event) =>
              setCaps({
                ...caps,
                perDayUnits: Math.trunc(event.target.valueAsNumber || 1),
              })
            }
            className="border-rule-strong bg-ground-raised text-text w-32 border px-3 py-2.5 text-[14px]"
          />
        </div>
        <Button type="submit" variant="secondary">
          Save caps
        </Button>
      </form>
    </section>
  );
}
