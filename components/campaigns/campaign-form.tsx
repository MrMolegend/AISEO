'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextField, TextAreaField, RadioCards } from '@/components/ui/field';

/**
 * The campaign builder.
 *
 * A campaign narrows its ideal customer profile: picking a profile loads
 * its territories and caps as the ceiling, and the form cannot widen them.
 * Nothing here spends — the detail page previews the cost and asks for an
 * explicit confirmation before research starts.
 */

export interface IcpOption {
  id: string;
  name: string;
  territoryKeys: string[];
  maxAccounts: number;
  maxContactsPerAccount: number;
  researchBudgetUnits: number;
}

interface FieldError {
  field: string;
  message: string;
}

export function CampaignForm({
  icps,
  territoryNames,
}: {
  icps: IcpOption[];
  territoryNames: Record<string, string>;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [icpId, setIcpId] = useState(icps[0]?.id ?? '');
  const [objective, setObjective] = useState('');
  const [territoryKeys, setTerritoryKeys] = useState<string[]>(
    icps[0]?.territoryKeys ?? [],
  );
  const [language, setLanguage] = useState('en');
  const [maxAccounts, setMaxAccounts] = useState(icps[0]?.maxAccounts ?? 25);
  const [maxContacts, setMaxContacts] = useState(icps[0]?.maxContactsPerAccount ?? 3);
  const [budgetUnits, setBudgetUnits] = useState(icps[0]?.researchBudgetUnits ?? 50);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const icp = useMemo(() => icps.find((option) => option.id === icpId), [icps, icpId]);

  function adoptIcp(id: string) {
    setIcpId(id);
    const chosen = icps.find((option) => option.id === id);
    if (chosen) {
      setTerritoryKeys(chosen.territoryKeys);
      setMaxAccounts(chosen.maxAccounts);
      setMaxContacts(chosen.maxContactsPerAccount);
      setBudgetUnits(chosen.researchBudgetUnits);
    }
  }

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  async function save() {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          icpId,
          objective,
          territoryKeys,
          language,
          maxAccounts,
          maxContactsPerAccount: maxContacts,
          budgetUnits,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const issues = payload?.issues as FieldError[] | undefined;
        if (issues && issues.length > 0) setErrors(issues);
        else {
          setFailure(payload?.message ?? 'The campaign could not be saved. Try again.');
        }
        return;
      }
      router.push(`/campaigns/${payload.campaign.id}`);
      router.refresh();
    } catch {
      setFailure('We could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

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
          label="Campaign name"
          name="name"
          required
          value={name}
          onChange={setName}
          hint="“Dubai independents, premium dog lines” beats “Campaign 3”."
          error={errorFor('name')}
        />

        <div>
          <label
            htmlFor="campaign-icp"
            className="text-text mb-2 block text-[13px] font-medium"
          >
            Ideal customer profile
          </label>
          <select
            id="campaign-icp"
            value={icpId}
            onChange={(event) => adoptIcp(event.target.value)}
            className="border-rule-strong bg-ground-raised text-text w-full max-w-md border px-3 py-2.5 text-[14px]"
          >
            {icps.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          {errorFor('icpId') && (
            <p role="alert" className="text-copper mt-1 text-[13px]">
              {errorFor('icpId')}
            </p>
          )}
        </div>

        <TextAreaField
          label="Product or brand objective"
          name="objective"
          rows={2}
          value={objective}
          onChange={setObjective}
          hint="What ALT wants these accounts for — a category push, a brand launch, a territory expansion."
          error={errorFor('objective')}
        />
      </div>

      <Rule label="Territories" className="mt-10" />
      <fieldset className="mt-6">
        <legend className="text-text text-[13px] font-medium">
          Within the profile&rsquo;s coverage
        </legend>
        {errorFor('territoryKeys') && (
          <p role="alert" className="text-copper mt-1 text-[13px]">
            {errorFor('territoryKeys')}
          </p>
        )}
        <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {(icp?.territoryKeys ?? []).map((key) => (
            <label key={key} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={territoryKeys.includes(key)}
                onChange={() =>
                  setTerritoryKeys((current) =>
                    current.includes(key)
                      ? current.filter((item) => item !== key)
                      : [...current, key],
                  )
                }
                className="accent-[var(--color-signal)]"
              />
              <span className="text-text-muted text-[13px]">
                {territoryNames[key] ?? key}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Rule label="Limits" className="mt-10" />
      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-3">
        <BoundedNumber
          label="Max accounts"
          name="maxAccounts"
          value={maxAccounts}
          ceiling={icp?.maxAccounts ?? 200}
          onChange={setMaxAccounts}
        />
        <BoundedNumber
          label="Contacts per account"
          name="maxContactsPerAccount"
          value={maxContacts}
          ceiling={icp?.maxContactsPerAccount ?? 10}
          onChange={setMaxContacts}
        />
        <BoundedNumber
          label="Budget (units)"
          name="budgetUnits"
          value={budgetUnits}
          ceiling={icp?.researchBudgetUnits ?? 2000}
          onChange={setBudgetUnits}
        />
      </div>

      <div className="mt-8 max-w-md">
        <RadioCards
          label="Outreach language"
          name="language"
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'en', label: 'English' },
            { value: 'ar', label: 'Arabic' },
            { value: 'both', label: 'Both' },
          ]}
          columns={3}
        />
      </div>

      {failure && (
        <p role="alert" className="text-copper mt-8 text-[14px] leading-relaxed">
          {failure}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || icps.length === 0}>
          {busy ? 'Creating…' : 'Create campaign'}
        </Button>
        <Meta aria-hidden="true">Nothing spends until you confirm the preview</Meta>
      </div>
    </form>
  );
}

function BoundedNumber({
  label,
  name,
  value,
  ceiling,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  ceiling: number;
  onChange: (value: number) => void;
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
        min={1}
        max={ceiling}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) =>
          onChange(Math.min(ceiling, Math.trunc(event.target.valueAsNumber || 1)))
        }
        className="border-rule-strong bg-ground-raised text-text w-full border px-3 py-2.5 text-[14px]"
      />
      <p className="text-text-subtle mt-1 text-[12px]" data-numeric>
        Profile ceiling: {ceiling}
      </p>
    </div>
  );
}
