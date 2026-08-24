'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TextField, TextAreaField, SelectField, ListField } from './fields';
import { Card, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPackage, type ResearchPackageId } from '@/config/packages';
import { BRAND } from '@/config/brand';
import { formatTokens } from '@/config/tokens';

/**
 * The research brief, and the confirmation before it costs anything.
 *
 * Two states rather than one screen: fill in, then confirm. The confirmation
 * exists because this is the moment a balance is spent, and a form that starts
 * a paid job on the same click that validates it gives the user nowhere to
 * change their mind.
 *
 * The submission id is generated once, when the component mounts, and reused
 * for every attempt of this brief. That is what makes a double-click, a
 * flaky connection or an impatient refresh cost one report rather than two —
 * the server matches on it and replays instead of charging again.
 */

interface FieldError {
  field: string;
  message: string;
}

export function ResearchForm({
  packageId,
  available,
}: {
  packageId: ResearchPackageId;
  available: number;
}) {
  const router = useRouter();
  const pkg = getPackage(packageId);

  // One id per mount, minted on the first submit attempt. Regenerating it per
  // attempt would defeat the idempotency it exists to provide, and minting it
  // during render would be an impure read of the clock and the RNG. It cannot
  // be useId(): that is stable across tabs, so two genuine submissions would
  // collide and the second would be silently treated as a replay of the first.
  const submissionId = useRef<string | null>(null);

  const [values, setValues] = useState<Record<string, unknown>>(() =>
    defaults(packageId),
  );
  const [phase, setPhase] = useState<'form' | 'confirm' | 'submitting'>('form');
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [failure, setFailure] = useState<{ title: string; message: string } | null>(null);

  const affordable = available >= pkg.tokenCost;
  const set = (key: string) => (value: unknown) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;

  function review(event: React.FormEvent) {
    event.preventDefault();
    setFailure(null);

    // Only presence is checked here. The real validation is the server's Zod
    // schema, and duplicating its rules in the browser is how the two drift.
    const missing = requiredFieldsFor(packageId).filter((field) => {
      const value = values[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missing.length > 0) {
      setErrors(missing.map((field) => ({ field, message: 'This is required' })));
      // Move focus to the first problem rather than leaving the user to find it.
      document.getElementsByName(missing[0]!)[0]?.focus();
      return;
    }

    setErrors([]);
    setPhase('confirm');
  }

  async function submit() {
    if (phase === 'submitting') return;
    setPhase('submitting');
    setFailure(null);

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...values,
          packageId,
          submissionId: (submissionId.current ??= crypto.randomUUID()),
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        if (payload?.issues) {
          setErrors(
            (payload.issues as Array<{ field: string; message: string }>).map(
              (issue) => ({
                field: issue.field,
                message: issue.message,
              }),
            ),
          );
          setPhase('form');
          return;
        }
        setFailure({
          title: payload?.title ?? 'We could not start that research',
          message: payload?.message ?? 'Please try again in a moment.',
        });
        setPhase('confirm');
        return;
      }

      router.push(`/research/${payload.publicId}`);
    } catch {
      setFailure({
        title: 'We could not reach the server',
        message: 'Check your connection and try again. Nothing has been charged.',
      });
      setPhase('confirm');
    }
  }

  if (phase === 'confirm' || phase === 'submitting') {
    return (
      <ConfirmStep
        pkg={pkg}
        values={values}
        available={available}
        busy={phase === 'submitting'}
        failure={failure}
        onBack={() => {
          setFailure(null);
          setPhase('form');
        }}
        onConfirm={submit}
      />
    );
  }

  return (
    <form onSubmit={review} noValidate className="space-y-6">
      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-[var(--color-severity-critical-line)] bg-[var(--color-severity-critical-bg)] p-4"
        >
          <p className="text-sm font-medium text-[var(--color-severity-critical)]">
            {errors.length === 1
              ? 'One field needs attention'
              : `${errors.length} fields need attention`}
          </p>
        </div>
      )}

      {fieldsFor(packageId).map((field) => (
        <FieldRenderer
          key={field.name}
          field={field}
          value={values[field.name]}
          onChange={set(field.name)}
          error={errorFor(field.name)}
        />
      ))}

      <div className="border-line flex flex-wrap items-center gap-4 border-t pt-6">
        <button
          type="submit"
          disabled={!affordable}
          className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand inline-flex h-12 items-center rounded-[var(--radius-control)] px-6 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review and confirm
        </button>

        <p className="text-ink-subtle text-sm tabular-nums">
          Costs {formatTokens(pkg.tokenCost)} {BRAND.currency.plural} · you have{' '}
          {formatTokens(available)}
        </p>
      </div>

      {!affordable && (
        <div
          role="status"
          className="border-line bg-surface-subtle rounded-[var(--radius-card)] border p-5"
        >
          <p className="text-ink text-sm font-medium">
            Not enough {BRAND.currency.plural} for this package
          </p>
          <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
            {pkg.name} costs {formatTokens(pkg.tokenCost)} and your balance is{' '}
            {formatTokens(available)}. Nothing has been charged.
          </p>
          <Link
            href="/wallet"
            className="text-brand hover:text-brand-hover focus-visible:ring-brand mt-3 inline-block rounded text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Go to your wallet
          </Link>
        </div>
      )}
    </form>
  );
}

/* ─────────────────────────── Confirmation ───────────────────────────────── */

function ConfirmStep({
  pkg,
  values,
  available,
  busy,
  failure,
  onBack,
  onConfirm,
}: {
  pkg: ReturnType<typeof getPackage>;
  values: Record<string, unknown>;
  available: number;
  busy: boolean;
  failure: { title: string; message: string } | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const summary = fieldsFor(pkg.id)
    .map((field) => ({ label: field.label, value: values[field.name] }))
    .filter(({ value }) => {
      if (Array.isArray(value)) return value.length > 0;
      return typeof value === 'string' && value.trim().length > 0;
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-ink text-lg font-semibold">Confirm this research</h2>
            <Badge tone="brand">
              {formatTokens(pkg.tokenCost)} {BRAND.currency.plural}
            </Badge>
          </div>

          <dl className="mt-5 space-y-3">
            {summary.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                <dt className="text-ink-subtle w-44 shrink-0 text-sm">{label}</dt>
                <dd className="text-ink text-sm leading-relaxed break-words">
                  {Array.isArray(value) ? value.join(', ') : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <div className="border-line bg-surface-subtle rounded-[var(--radius-card)] border p-5">
        <p className="text-ink text-sm leading-relaxed">
          Confirming spends {formatTokens(pkg.tokenCost)} {BRAND.currency.plural}, leaving{' '}
          <span className="tabular-nums">{formatTokens(available - pkg.tokenCost)}</span>.
          They are held while the research runs and returned automatically if it fails on
          our side.
        </p>
        <p className="text-ink-subtle mt-2 text-sm leading-relaxed">
          Typically {pkg.typicalDurationMinutes[0]}–{pkg.typicalDurationMinutes[1]}{' '}
          minutes. You can leave the page and come back.
        </p>
      </div>

      {failure && (
        <div
          role="alert"
          className="rounded-[var(--radius-card)] border border-[var(--color-severity-critical-line)] bg-[var(--color-severity-critical-bg)] p-5"
        >
          <p className="text-sm font-medium text-[var(--color-severity-critical)]">
            {failure.title}
          </p>
          <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
            {failure.message}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="bg-brand text-ink-inverse hover:bg-brand-hover focus-visible:ring-brand inline-flex h-12 items-center rounded-[var(--radius-control)] px-6 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Starting…' : `Spend ${formatTokens(pkg.tokenCost)} and start`}
        </button>

        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="border-line-strong bg-surface text-ink hover:bg-surface-subtle focus-visible:ring-brand inline-flex h-12 items-center rounded-[var(--radius-control)] border px-6 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
        >
          Back to the form
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── Field definitions ────────────────────────────── */

type FieldKind = 'text' | 'url' | 'textarea' | 'select' | 'list' | 'number';

interface FieldDef {
  name: string;
  kind: FieldKind;
  label: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  options?: ReadonlyArray<{ value: string; label: string }>;
}

const MARKET_FIELD: FieldDef = {
  name: 'market',
  kind: 'text',
  label: 'Country or target market',
  hint: 'A country, a region, or a city. We prefer results from this market.',
  placeholder: 'United Kingdom',
  required: true,
};

const WEBSITE_FIELD: FieldDef = {
  name: 'website',
  kind: 'url',
  label: 'Website',
  hint: 'We read this site first, to understand what you actually sell.',
  placeholder: 'example.com',
  required: true,
};

const PLATFORM_OPTIONS = [
  { value: 'mixed', label: 'Mixed — let the research decide' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'linkedin', label: 'LinkedIn' },
] as const;

const FIELDS: Record<ResearchPackageId, FieldDef[]> = {
  'competitor-intelligence': [
    {
      name: 'companyName',
      kind: 'text',
      label: 'Company or product name',
      required: true,
      placeholder: 'Acme Consulting',
    },
    WEBSITE_FIELD,
    MARKET_FIELD,
    {
      name: 'industry',
      kind: 'text',
      label: 'Industry',
      placeholder: 'Management consulting',
    },
    {
      name: 'customerDescription',
      kind: 'textarea',
      label: 'Who your customers are',
      hint: 'The more specific, the better the competitor matching.',
      maxLength: 600,
    },
    {
      name: 'knownCompetitors',
      kind: 'list',
      label: 'Competitors you already know of',
      hint: 'Comma-separated. A starting point, not a limit.',
      placeholder: 'Beta Ltd, Gamma Group',
    },
    {
      name: 'specificQuestions',
      kind: 'textarea',
      label: 'Anything specific you want answered',
      maxLength: 800,
    },
  ],

  'lead-finder': [
    { name: 'businessName', kind: 'text', label: 'Business name', required: true },
    WEBSITE_FIELD,
    {
      name: 'offerDescription',
      kind: 'textarea',
      label: 'What you sell',
      hint: 'What it is, who it is for, and what problem it solves.',
      required: true,
      maxLength: 1200,
    },
    MARKET_FIELD,
    {
      name: 'audienceType',
      kind: 'select',
      label: 'Who you sell to',
      options: [
        { value: 'b2b', label: 'Other businesses (B2B)' },
        { value: 'b2c', label: 'Consumers (B2C)' },
      ],
      hint: 'This finder covers organisations, so B2B produces stronger results.',
    },
    { name: 'targetIndustry', kind: 'text', label: 'Industry to target' },
    {
      name: 'idealCompanySize',
      kind: 'text',
      label: 'Ideal customer size',
      placeholder: 'Under 50 staff',
      hint: 'In whatever terms you actually use.',
    },
    { name: 'minCompanySize', kind: 'number', label: 'Minimum headcount' },
    { name: 'maxCompanySize', kind: 'number', label: 'Maximum headcount' },
    {
      name: 'exclusions',
      kind: 'textarea',
      label: 'Anything to exclude',
      maxLength: 600,
      placeholder: 'Existing customers, direct competitors',
    },
  ],

  'influencer-outreach': [
    { name: 'brandName', kind: 'text', label: 'Brand name', required: true },
    WEBSITE_FIELD,
    {
      name: 'productDescription',
      kind: 'textarea',
      label: 'What you are promoting',
      required: true,
      maxLength: 1200,
    },
    {
      name: 'campaignGoal',
      kind: 'textarea',
      label: 'What the campaign should achieve',
      required: true,
      maxLength: 600,
      placeholder: 'Awareness among first-time buyers before our spring launch',
    },
    {
      name: 'targetCustomer',
      kind: 'textarea',
      label: 'Who you want to reach',
      required: true,
      maxLength: 800,
    },
    MARKET_FIELD,
    { name: 'platform', kind: 'select', label: 'Platform', options: PLATFORM_OPTIONS },
    { name: 'niche', kind: 'text', label: 'Creator niche' },
    {
      name: 'creatorSize',
      kind: 'select',
      label: 'Creator size',
      options: [
        { value: 'any', label: 'Any size' },
        { value: 'nano', label: 'Nano' },
        { value: 'micro', label: 'Micro' },
        { value: 'mid', label: 'Mid-tier' },
        { value: 'macro', label: 'Macro' },
      ],
      hint: 'A preference. We rank on audience fit rather than size.',
    },
    {
      name: 'exclusions',
      kind: 'textarea',
      label: 'Anything to exclude',
      maxLength: 600,
    },
  ],

  'market-pack': [
    { name: 'businessName', kind: 'text', label: 'Business name', required: true },
    WEBSITE_FIELD,
    {
      name: 'offerDescription',
      kind: 'textarea',
      label: 'What you sell',
      required: true,
      maxLength: 1200,
    },
    MARKET_FIELD,
    { name: 'industry', kind: 'text', label: 'Industry' },
    {
      name: 'targetCustomer',
      kind: 'textarea',
      label: 'Who you want to reach',
      required: true,
      maxLength: 800,
    },
    {
      name: 'audienceType',
      kind: 'select',
      label: 'Who you sell to',
      options: [
        { value: 'b2b', label: 'Other businesses (B2B)' },
        { value: 'b2c', label: 'Consumers (B2C)' },
      ],
    },
    { name: 'idealCompanySize', kind: 'text', label: 'Ideal customer size' },
    {
      name: 'knownCompetitors',
      kind: 'list',
      label: 'Competitors you already know of',
      placeholder: 'Beta Ltd, Gamma Group',
    },
    {
      name: 'platform',
      kind: 'select',
      label: 'Creator platform',
      options: PLATFORM_OPTIONS,
    },
    { name: 'campaignGoal', kind: 'textarea', label: 'Campaign goal', maxLength: 600 },
    {
      name: 'exclusions',
      kind: 'textarea',
      label: 'Anything to exclude',
      maxLength: 600,
    },
    {
      name: 'specificQuestions',
      kind: 'textarea',
      label: 'Anything specific you want answered',
      maxLength: 800,
    },
  ],
};

function fieldsFor(packageId: ResearchPackageId): FieldDef[] {
  return FIELDS[packageId];
}

function requiredFieldsFor(packageId: ResearchPackageId): string[] {
  return fieldsFor(packageId)
    .filter((field) => field.required)
    .map((field) => field.name);
}

function defaults(packageId: ResearchPackageId): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fieldsFor(packageId)) {
    if (field.kind === 'list') out[field.name] = [];
    else if (field.kind === 'select') out[field.name] = field.options?.[0]?.value ?? '';
    else out[field.name] = '';
  }
  return out;
}

function FieldRenderer({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const shared = {
    label: field.label,
    name: field.name,
    hint: field.hint,
    error,
    required: field.required,
  };

  switch (field.kind) {
    case 'textarea':
      return (
        <TextAreaField
          {...shared}
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
        />
      );
    case 'select':
      return (
        <SelectField
          {...shared}
          value={String(value ?? '')}
          onChange={onChange}
          options={field.options ?? []}
        />
      );
    case 'list':
      return (
        <ListField
          {...shared}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
    case 'number':
      return (
        <TextField
          {...shared}
          value={String(value ?? '')}
          onChange={onChange}
          inputMode="numeric"
          placeholder={field.placeholder}
        />
      );
    case 'url':
      return (
        <TextField
          {...shared}
          value={String(value ?? '')}
          onChange={onChange}
          inputMode="url"
          autoComplete="url"
          placeholder={field.placeholder}
        />
      );
    default:
      return (
        <TextField
          {...shared}
          value={String(value ?? '')}
          onChange={onChange}
          placeholder={field.placeholder}
        />
      );
  }
}
