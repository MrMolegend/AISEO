'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { BRAND } from '@/config/brand';
import { countryName, currencyFor } from '@/config/markets';
import {
  STAGE_IDS,
  STAGE_TITLES,
  STAGE_PURPOSE,
  STAGE_SCHEMAS,
  FIELD_STAGE,
  BUSINESS_STATUS_LABEL,
  ROUTE_LABEL,
  CUSTOMER_TYPE_LABEL,
  LAUNCH_TIMEFRAME_LABEL,
  type StageKey,
} from '@/schemas/market-entry/input';
import {
  OfferStage,
  TargetStage,
  CommercialStage,
  ObjectivesStage,
  type Values,
} from './stage-fields';

/**
 * The four-stage intake.
 *
 * Progressive rather than one long page, and the reason is not fashion: this
 * brief is the entire input to the research, because there is no website to
 * read instead. A single scrolling form of thirty fields gets abandoned, and an
 * abandoned form produces no report at all; four screens of seven or eight get
 * finished, and each one can carry the context that makes its answers useful.
 *
 * Three behaviours matter more than they look:
 *
 *   **Backwards navigation never validates.** Going back to check what you
 *   wrote is not an error condition, and a form that blocks it teaches people
 *   not to look.
 *
 *   **The draft is saved as you type.** Losing four stages of typing to a
 *   closed tab is the single worst thing this form could do, and it is exactly
 *   what happens without this.
 *
 *   **The submission id is minted once.** A double-click, a flaky connection or
 *   an impatient refresh costs one report rather than two, because the server
 *   matches on it and replays instead of charging again.
 */

const STAGE_COMPONENTS = {
  offer: OfferStage,
  target: TargetStage,
  commercial: CommercialStage,
  objectives: ObjectivesStage,
} as const;

interface FieldError {
  field: string;
  message: string;
}

function draftKey(userId: string): string {
  return `corridor.assessment.${userId}`;
}

function emptyValues(): Values {
  return { knownCompetitors: [], launchTimeframe: 'undecided' };
}

export function AssessmentForm({
  userId,
  credits,
  initialValues = null,
}: {
  userId: string;
  /** Whole report credits available. Never a token count. */
  credits: number;
  /** Seeded from a previous assessment when retrying one that failed. */
  initialValues?: Record<string, unknown> | null;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Values>(() =>
    initialValues ? { ...emptyValues(), ...initialValues } : emptyValues(),
  );
  const [stageIndex, setStageIndex] = useState(0);
  const [phase, setPhase] = useState<'stages' | 'review' | 'submitting'>('stages');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);
  const [restored, setRestored] = useState(false);

  /*
   * Minted on the first submit attempt, not at mount, and reused for every
   * later attempt of this brief. Deliberately not useId(): that is stable
   * across tabs, so two genuine submissions would collide and the second would
   * be silently treated as a replay of the first.
   */
  const submissionId = useRef<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stageKey: StageKey = STAGE_IDS[stageIndex]!;
  const affordable = credits >= 1;

  /* ── Draft restoration and auto-save ───────────────────────────────────── */

  /*
   * Restoring the draft, once, at mount.
   *
   * react-hooks/set-state-in-effect is disabled here deliberately rather than
   * worked around. Its concern is cascading renders, and there is none: this
   * runs once per mount, reads a value that cannot exist during server
   * rendering, and never runs again. The alternatives are all worse — a lazy
   * useState initialiser reads localStorage during hydration and produces a
   * mismatch against the server's empty form, and a `hydrated` flag is the same
   * setState in the same effect with an extra render on top.
   */
  useEffect(() => {
    // A seeded retry is the intended starting point; a saved draft from an
    // abandoned assessment must not silently overwrite it.
    if (initialValues) return;

    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(draftKey(userId));
    } catch {
      // Private browsing, disabled storage, quota. A missing draft is not worth
      // a broken form.
      return;
    }
    if (!saved) return;

    try {
      const parsed: unknown = JSON.parse(saved);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
        setValues({ ...emptyValues(), ...(parsed as Values) });
        setRestored(true);
      }
    } catch {
      // A corrupt draft is discarded rather than repaired.
    }
  }, [userId, initialValues]);

  useEffect(() => {
    try {
      window.localStorage.setItem(draftKey(userId), JSON.stringify(values));
    } catch {
      // Storage full or blocked. The form still works; the draft does not
      // survive a closed tab, which is worth nothing said and everything not
      // crashed over.
    }
  }, [values, userId]);

  const set = useCallback(
    (key: string) => (value: unknown) => {
      setValues((previous) => ({ ...previous, [key]: value }));
      // Clearing the error as they fix it is the difference between guidance
      // and nagging.
      setErrors((previous) => previous.filter((error) => error.field !== key));
    },
    [],
  );

  const errorFor = useCallback(
    (field: string) => errors.find((error) => error.field === field)?.message,
    [errors],
  );

  /* ── Validation ────────────────────────────────────────────────────────── */

  /**
   * Validates one stage against the same Zod schema the server will use.
   *
   * Not a second set of rules written in the browser — that is how client and
   * server validation drift until a form accepts something the API rejects. The
   * stage schemas are slices of the submission schema, so passing here means
   * passing there, and the parsed result is discarded: money fields transform
   * to minor units on the way through and writing that back into state would
   * multiply a price by a hundred every time someone revisited the stage.
   */
  function validateStage(key: StageKey): FieldError[] {
    const schema = STAGE_SCHEMAS[key];
    const subset: Values = {};
    for (const field of Object.keys(schema.shape)) subset[field] = values[field];

    const result = schema.safeParse(subset);
    if (result.success) return [];

    return result.error.issues.map((issue) => ({
      field: String(issue.path[0] ?? ''),
      message: issue.message,
    }));
  }

  function goToStage(index: number): void {
    setStageIndex(index);
    setFailure(null);
    // Focus lands on the new stage's heading, so a screen reader announces
    // where it now is rather than leaving focus on a button that has gone.
    window.requestAnimationFrame(() => headingRef.current?.focus());
  }

  function next(): void {
    const found = validateStage(stageKey);
    if (found.length > 0) {
      setErrors(found);
      const first = found[0];
      if (first) document.getElementsByName(first.field)[0]?.focus();
      return;
    }
    setErrors([]);
    if (stageIndex < STAGE_IDS.length - 1) goToStage(stageIndex + 1);
    else {
      setPhase('review');
      window.requestAnimationFrame(() => headingRef.current?.focus());
    }
  }

  /* ── Submission ────────────────────────────────────────────────────────── */

  async function submit(): Promise<void> {
    if (phase === 'submitting') return;
    setPhase('submitting');
    setFailure(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...values,
          packageId: 'market-entry',
          submissionId: (submissionId.current ??= crypto.randomUUID()),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const issues = payload?.issues as FieldError[] | undefined;
        if (issues && issues.length > 0) {
          setErrors(issues);
          /*
           * Send the user to the stage that owns the first bad field.
           *
           * Without this the message renders on a stage nobody is looking at,
           * which on a four-stage form is the same as not rendering it.
           */
          const owner = FIELD_STAGE[issues[0]!.field];
          const target = owner ? STAGE_IDS.indexOf(owner) : 0;
          setPhase('stages');
          goToStage(target === -1 ? 0 : target);
          return;
        }
        setFailure({
          title: payload?.title ?? 'We could not start that assessment',
          message: payload?.message ?? 'Please try again in a moment.',
        });
        setPhase('review');
        return;
      }

      try {
        window.localStorage.removeItem(draftKey(userId));
      } catch {
        // Nothing to do; the draft is stale rather than harmful.
      }
      router.push(`/research/${payload.publicId}`);
    } catch {
      setFailure({
        title: 'We could not reach the server',
        message: 'Check your connection and try again. Nothing has been reserved.',
      });
      setPhase('review');
    }
  }

  /* ── Render ────────────────────────────────────────────────────────────── */

  const StageComponent = STAGE_COMPONENTS[stageKey];

  if (phase === 'review' || phase === 'submitting') {
    return (
      <ReviewStage
        values={values}
        busy={phase === 'submitting'}
        failure={failure}
        affordable={affordable}
        headingRef={headingRef}
        onEdit={(index) => {
          setPhase('stages');
          goToStage(index);
        }}
        onConfirm={submit}
      />
    );
  }

  return (
    <div>
      <StageRail current={stageIndex} onSelect={goToStage} />

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-text mt-8 text-[28px] leading-tight outline-none"
      >
        {STAGE_TITLES[stageKey]}
      </h2>
      <p className="text-text-muted measure mt-2 text-[15px] leading-relaxed">
        {STAGE_PURPOSE[stageKey]}
      </p>

      {restored && stageIndex === 0 && (
        <p role="status" className="text-text-subtle mt-4 text-[13px]">
          Your previous answers have been restored.
        </p>
      )}

      {errors.length > 0 && (
        <div
          role="alert"
          className="border-copper-line bg-copper-surface mt-6 border-l-[3px] p-4"
        >
          <p className="text-copper text-[14px] font-medium">
            {errors.length === 1
              ? 'One answer needs another look'
              : `${errors.length} answers need another look`}
          </p>
          <ul className="text-text-muted mt-2 space-y-1 text-[13px]">
            {errors.slice(0, 6).map((error) => (
              <li key={error.field}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8">
        <StageComponent values={values} set={set} errorFor={errorFor} />
      </div>

      <div className="border-rule mt-10 flex flex-wrap items-center gap-3 border-t pt-6">
        {stageIndex > 0 && (
          <Button variant="secondary" onClick={() => goToStage(stageIndex - 1)}>
            Back
          </Button>
        )}
        <Button onClick={next}>
          {stageIndex === STAGE_IDS.length - 1 ? 'Review' : 'Continue'}
        </Button>
        <Meta className="ml-auto">
          Stage {stageIndex + 1} of {STAGE_IDS.length}
        </Meta>
      </div>
    </div>
  );
}

/* ─────────────────────────────── The rail ────────────────────────────────── */

function StageRail({
  current,
  onSelect,
}: {
  current: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Assessment stages">
      <ol className="grid grid-cols-4 gap-1.5">
        {STAGE_IDS.map((key, index) => {
          const state =
            index < current ? 'done' : index === current ? 'current' : 'ahead';
          return (
            <li key={key}>
              <button
                type="button"
                /* Only backwards. Skipping ahead past validation would let
                   someone reach the review screen with an empty stage 2. */
                disabled={index > current}
                onClick={() => onSelect(index)}
                aria-current={state === 'current' ? 'step' : undefined}
                className={
                  state === 'ahead'
                    ? 'border-rule text-text-faint w-full cursor-not-allowed border-t-2 pt-2 text-left'
                    : state === 'current'
                      ? 'border-signal text-text w-full border-t-2 pt-2 text-left'
                      : 'border-signal-dim text-text-muted hover:text-text w-full border-t-2 pt-2 text-left transition-colors'
                }
              >
                <span className="meta block">
                  {String(index + 1).padStart(2, '0')}
                  {state === 'done' && <span className="sr-only"> — completed</span>}
                </span>
                <span className="mt-0.5 block text-[12px] leading-tight sm:text-[13px]">
                  {STAGE_TITLES[key]}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ────────────────────────────── The review ───────────────────────────────── */

function ReviewStage({
  values,
  busy,
  failure,
  affordable,
  headingRef,
  onEdit,
  onConfirm,
}: {
  values: Values;
  busy: boolean;
  failure: { title: string; message: string } | null;
  affordable: boolean;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onEdit: (index: number) => void;
  onConfirm: () => void;
}) {
  const summary = useMemo(() => buildSummary(values), [values]);

  return (
    <div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-text text-[28px] leading-tight outline-none"
      >
        Before we start
      </h2>
      <p className="text-text-muted measure mt-2 text-[15px] leading-relaxed">
        Check the brief. The research is built entirely from these answers, so a minute
        here is worth more than anything you can change afterwards.
      </p>

      <div className="mt-8 space-y-8">
        {STAGE_IDS.map((key, index) => (
          <section key={key} aria-labelledby={`review-${key}`}>
            <div className="flex items-baseline justify-between gap-4">
              <h3 id={`review-${key}`} className="text-text text-[15px] font-medium">
                {STAGE_TITLES[key]}
              </h3>
              <button
                type="button"
                onClick={() => onEdit(index)}
                className="text-cobalt rounded text-[13px] underline-offset-4 hover:underline"
              >
                Edit
                <span className="sr-only"> {STAGE_TITLES[key]}</span>
              </button>
            </div>
            <Rule className="mt-2" />
            <dl className="mt-3 space-y-2.5">
              {summary[key].length === 0 ? (
                <p className="text-text-faint text-[13px]">Nothing entered.</p>
              ) : (
                summary[key].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                    <dt className="text-text-subtle w-56 shrink-0 text-[13px]">
                      {label}
                    </dt>
                    <dd className="text-text text-[14px] leading-relaxed break-words">
                      {value}
                    </dd>
                  </div>
                ))
              )}
            </dl>
          </section>
        ))}
      </div>

      <Panel edge="signal" className="mt-10">
        <div className="p-5">
          <p className="text-text text-[15px] leading-relaxed">
            Starting this assessment reserves{' '}
            <strong className="font-medium">one {BRAND.credit.singular}</strong>. It is
            only spent once a report has been produced and passed our evidence checks — if
            it cannot be, the credit is returned automatically.
          </p>
          <p className="text-text-subtle mt-2 text-[13px] leading-relaxed">
            Research usually takes three to eight minutes. You can close this page and
            come back; the report waits in your dashboard.
          </p>
        </div>
      </Panel>

      {!affordable && (
        <div
          role="status"
          className="border-copper-line bg-copper-surface mt-4 border-l-[3px] p-4"
        >
          <p className="text-copper text-[14px] font-medium">
            You have no {BRAND.credit.plural} left
          </p>
          <p className="text-text-muted mt-1.5 text-[13px] leading-relaxed">
            Nothing has been reserved. During the beta, credits are granted manually — get
            in touch at {BRAND.supportEmail}.
          </p>
        </div>
      )}

      {failure && (
        <div
          role="alert"
          className="border-copper-line bg-copper-surface mt-4 border-l-[3px] p-4"
        >
          <p className="text-copper text-[14px] font-medium">{failure.title}</p>
          <p className="text-text-muted mt-1.5 text-[13px] leading-relaxed">
            {failure.message}
          </p>
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onConfirm} disabled={busy || !affordable}>
          {busy ? 'Starting…' : 'Start the assessment'}
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Save and come back later</Link>
        </Button>
      </div>
    </div>
  );
}

/* ──────────────────────────── Summary rendering ──────────────────────────── */

const FIELD_LABELS: Record<string, string> = {
  businessName: 'Business',
  productName: 'Product',
  offerDescription: 'What it is',
  category: 'Category',
  originCountry: 'Operates from',
  businessStatus: 'Business status',
  supplyArrangements: 'Supply and delivery',
  productCharacteristics: 'Product characteristics',
  targetCountry: 'Target market',
  targetRegion: 'Region',
  routeToMarket: 'Intended route',
  intendedCustomer: 'Buyer',
  customerDescription: 'Buyer described',
  marketReason: 'Why this market',
  currency: 'Currency',
  currentPrice: 'Current price',
  unitCost: 'Unit cost',
  targetPrice: 'Target price',
  launchBudget: 'Launch budget',
  minimumOrderQuantity: 'Minimum order',
  productionCapacity: 'Capacity',
  launchTimeframe: 'Launch timeframe',
  primaryObjective: 'Decision to make',
  biggestConcern: 'Biggest concern',
  knownCompetitors: 'Known competitors',
  existingContacts: 'Existing contacts',
  knownRegulations: 'Known regulations',
  additionalContext: 'Additional context',
  keyQuestion: 'Key question',
};

/** Renders a stored value the way the customer wrote it, not the way it is stored. */
function display(field: string, value: unknown, values: Values): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : null;

  const raw = String(value);
  switch (field) {
    case 'originCountry':
    case 'targetCountry':
      return countryName(raw);
    case 'businessStatus':
      return BUSINESS_STATUS_LABEL[raw as keyof typeof BUSINESS_STATUS_LABEL] ?? raw;
    case 'routeToMarket':
      return ROUTE_LABEL[raw as keyof typeof ROUTE_LABEL] ?? raw;
    case 'intendedCustomer':
      return CUSTOMER_TYPE_LABEL[raw as keyof typeof CUSTOMER_TYPE_LABEL] ?? raw;
    case 'launchTimeframe':
      return LAUNCH_TIMEFRAME_LABEL[raw as keyof typeof LAUNCH_TIMEFRAME_LABEL] ?? raw;
    case 'currency': {
      const currency = currencyFor(raw);
      return currency ? `${currency.name} (${currency.code})` : raw;
    }
    case 'currentPrice':
    case 'unitCost':
    case 'targetPrice':
    case 'launchBudget': {
      const code = values.currency ? String(values.currency) : '';
      return code ? `${raw} ${code}` : raw;
    }
    default:
      return raw;
  }
}

function buildSummary(
  values: Values,
): Record<StageKey, { label: string; value: string }[]> {
  const summary = {
    offer: [],
    target: [],
    commercial: [],
    objectives: [],
  } as Record<StageKey, { label: string; value: string }[]>;

  for (const [field, stage] of Object.entries(FIELD_STAGE)) {
    const rendered = display(field, values[field], values);
    if (rendered === null) continue;
    summary[stage].push({ label: FIELD_LABELS[field] ?? field, value: rendered });
  }

  return summary;
}
