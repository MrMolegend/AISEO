'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextField, TextAreaField, RadioCards } from '@/components/ui/field';
import { ChipInput } from '@/components/ui/chip-input';
import { DEFAULT_SEGMENTS } from '@/config/alt';
import { EVIDENCE_LEVELS, EVIDENCE_LEVEL_LABEL, type IcpCriteria } from '@/schemas/icp';

/**
 * The ideal customer profile form.
 *
 * One page, like the business-profile form: reference material edited in
 * passing. Territories and segments are closed choices rendered as
 * checkbox grids — discovery can only search where the workspace actually
 * operates. Everything in the criteria block is optional, and an empty
 * criterion constrains nothing.
 */

export interface TerritoryOption {
  key: string;
  name: string;
  kind: string;
  parentKey: string | null;
}

export interface IcpFormValues {
  name: string;
  territoryKeys: string[];
  segmentKeys: string[];
  minEvidenceLevel: (typeof EVIDENCE_LEVELS)[number];
  maxAccounts: number;
  maxContactsPerAccount: number;
  researchBudgetUnits: number;
  criteria: IcpCriteria;
}

export function emptyIcpValues(): IcpFormValues {
  return {
    name: '',
    territoryKeys: [],
    segmentKeys: [],
    minEvidenceLevel: 'standard',
    maxAccounts: 25,
    maxContactsPerAccount: 3,
    researchBudgetUnits: 50,
    criteria: {
      independentOrChain: 'either',
      estimatedLocations: 'unknown',
      petCategories: [],
      currentBrands: [],
      positioning: 'any',
      onlinePresence: 'any',
      serviceMix: [],
      procurementNotes: '',
      desiredCategories: [],
      exclusions: [],
      targetRoles: [],
      language: 'en',
    },
  };
}

interface FieldError {
  field: string;
  message: string;
}

export function IcpForm({
  icpId = null,
  initialValues,
  territories,
}: {
  icpId?: string | null;
  initialValues?: IcpFormValues;
  territories: TerritoryOption[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<IcpFormValues>(initialValues ?? emptyIcpValues());
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof IcpFormValues>(key: K) => {
    return (value: IcpFormValues[K]) => {
      setValues((previous) => ({ ...previous, [key]: value }));
      setErrors((previous) => previous.filter((error) => error.field !== key));
    };
  };

  const setCriteria = <K extends keyof IcpCriteria>(key: K, value: IcpCriteria[K]) => {
    setValues((previous) => ({
      ...previous,
      criteria: { ...previous.criteria, [key]: value },
    }));
  };

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  function toggle(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((item) => item !== key) : [...list, key];
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch(icpId ? `/api/icps/${icpId}` : '/api/icps', {
        method: icpId ? 'PUT' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const issues = payload?.issues as FieldError[] | undefined;
        if (issues && issues.length > 0) setErrors(issues);
        else setFailure(payload?.message ?? 'The profile could not be saved. Try again.');
        return;
      }
      router.push('/icps');
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const countries = territories.filter((territory) => territory.kind === 'country');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      noValidate
    >
      <div className="space-y-6">
        <TextField
          label="Profile name"
          name="name"
          required
          value={values.name}
          onChange={set('name')}
          hint="Something a colleague recognises: “UAE premium independents”, “KSA vet groups”."
          error={errorFor('name')}
        />
      </div>

      <Rule label="Where" className="mt-10" />
      <fieldset className="mt-6">
        <legend className="text-text text-[13px] font-medium">Territories</legend>
        {errorFor('territoryKeys') && (
          <p role="alert" className="text-copper mt-1 text-[13px]">
            {errorFor('territoryKeys')}
          </p>
        )}
        <div className="mt-3 space-y-4">
          {countries.map((country) => {
            const children = territories.filter(
              (territory) => territory.parentKey === country.key,
            );
            return (
              <div key={country.key}>
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={values.territoryKeys.includes(country.key)}
                    onChange={() =>
                      set('territoryKeys')(toggle(values.territoryKeys, country.key))
                    }
                    className="accent-[var(--color-signal)]"
                  />
                  <span className="text-text text-[14px] font-medium">
                    {country.name}
                  </span>
                </label>
                {children.length > 0 && (
                  <div className="mt-2 ml-6 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {children.map((child) => (
                      <label key={child.key} className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={values.territoryKeys.includes(child.key)}
                          onChange={() =>
                            set('territoryKeys')(toggle(values.territoryKeys, child.key))
                          }
                          className="accent-[var(--color-signal)]"
                        />
                        <span className="text-text-muted text-[13px]">{child.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      <Rule label="Who" className="mt-10" />
      <fieldset className="mt-6">
        <legend className="text-text text-[13px] font-medium">Customer segments</legend>
        {errorFor('segmentKeys') && (
          <p role="alert" className="text-copper mt-1 text-[13px]">
            {errorFor('segmentKeys')}
          </p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {DEFAULT_SEGMENTS.map((segment) => (
            <label key={segment.key} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={values.segmentKeys.includes(segment.key)}
                onChange={() =>
                  set('segmentKeys')(toggle(values.segmentKeys, segment.key))
                }
                className="accent-[var(--color-signal)]"
              />
              <span className="text-text-muted text-[13px]">{segment.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-8 space-y-6">
        <RadioCards
          label="Independent or chain"
          name="independentOrChain"
          value={values.criteria.independentOrChain}
          onChange={(value) =>
            setCriteria('independentOrChain', value as IcpCriteria['independentOrChain'])
          }
          options={[
            { value: 'independent', label: 'Independent' },
            { value: 'chain', label: 'Chains' },
            { value: 'either', label: 'Either' },
          ]}
          columns={3}
        />
        <RadioCards
          label="Price positioning"
          name="positioning"
          value={values.criteria.positioning}
          onChange={(value) =>
            setCriteria('positioning', value as IcpCriteria['positioning'])
          }
          options={[
            { value: 'premium', label: 'Premium' },
            { value: 'mid-market', label: 'Mid-market' },
            { value: 'value', label: 'Value' },
            { value: 'any', label: 'Any' },
          ]}
          columns={2}
        />
        <RadioCards
          label="Presence"
          name="onlinePresence"
          value={values.criteria.onlinePresence}
          onChange={(value) =>
            setCriteria('onlinePresence', value as IcpCriteria['onlinePresence'])
          }
          options={[
            { value: 'physical', label: 'Physical retail' },
            { value: 'ecommerce', label: 'E-commerce' },
            { value: 'both', label: 'Both' },
            { value: 'any', label: 'Any' },
          ]}
          columns={2}
        />
        <ChipInput
          label="Pet categories served"
          name="petCategories"
          value={values.criteria.petCategories}
          onChange={(value) => setCriteria('petCategories', value)}
          max={15}
          placeholder="Dog, cat, aquatics…"
        />
        <ChipInput
          label="Target buyer roles"
          name="targetRoles"
          value={values.criteria.targetRoles}
          onChange={(value) => setCriteria('targetRoles', value)}
          max={15}
          placeholder="Purchasing manager, owner…"
        />
        <ChipInput
          label="Exclusions"
          name="exclusions"
          value={values.criteria.exclusions}
          onChange={(value) => setCriteria('exclusions', value)}
          max={30}
          placeholder="Account names or patterns to skip"
        />
        <TextAreaField
          label="Procurement notes"
          name="procurementNotes"
          rows={2}
          value={values.criteria.procurementNotes}
          onChange={(value) => setCriteria('procurementNotes', value)}
          hint="How these customers tend to buy, if known."
        />
        <RadioCards
          label="Outreach language"
          name="language"
          value={values.criteria.language}
          onChange={(value) => setCriteria('language', value as IcpCriteria['language'])}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'Arabic' },
            { value: 'both', label: 'Both' },
          ]}
          columns={3}
        />
      </div>

      <Rule label="Evidence and limits" className="mt-10" />
      <div className="mt-6 space-y-6">
        <RadioCards
          label="Minimum evidence before a lead reaches review"
          name="minEvidenceLevel"
          value={values.minEvidenceLevel}
          onChange={(value) =>
            set('minEvidenceLevel')(value as IcpFormValues['minEvidenceLevel'])
          }
          options={EVIDENCE_LEVELS.map((level) => ({
            value: level,
            label: EVIDENCE_LEVEL_LABEL[level],
          }))}
          columns={1}
          error={errorFor('minEvidenceLevel')}
        />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <NumberField
            label="Max accounts"
            name="maxAccounts"
            value={values.maxAccounts}
            min={1}
            max={200}
            onChange={set('maxAccounts')}
            error={errorFor('maxAccounts')}
          />
          <NumberField
            label="Max contacts per account"
            name="maxContactsPerAccount"
            value={values.maxContactsPerAccount}
            min={1}
            max={10}
            onChange={set('maxContactsPerAccount')}
            error={errorFor('maxContactsPerAccount')}
          />
          <NumberField
            label="Research budget (units)"
            name="researchBudgetUnits"
            value={values.researchBudgetUnits}
            min={1}
            max={2000}
            onChange={set('researchBudgetUnits')}
            error={errorFor('researchBudgetUnits')}
          />
        </div>
      </div>

      {failure && (
        <p role="alert" className="text-copper mt-8 text-[14px] leading-relaxed">
          {failure}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : icpId ? 'Save profile' : 'Create profile'}
        </Button>
        <Meta aria-hidden="true">Empty criteria constrain nothing</Meta>
      </div>
    </form>
  );
}

function NumberField({
  label,
  name,
  value,
  min,
  max,
  onChange,
  error,
}: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-text mb-2 block text-[13px] font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        aria-invalid={error ? true : undefined}
        className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
      />
      {error && (
        <p role="alert" className="text-copper mt-1 text-[13px]">
          {error}
        </p>
      )}
    </div>
  );
}
