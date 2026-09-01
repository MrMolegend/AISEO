'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Rule, Meta } from '@/components/ui/panel';
import { TextField, TextAreaField, RadioCards } from '@/components/ui/field';
import { ChipInput } from '@/components/ui/chip-input';
import { Combobox } from '@/components/ui/combobox';
import { COUNTRIES } from '@/config/markets';
import {
  BUSINESS_MODELS,
  BUSINESS_MODEL_LABEL,
  PRICE_POSITIONS,
  PRICE_POSITION_LABEL,
  type BusinessModel,
  type PricePosition,
} from '@/schemas/business-profile';
import {
  BUSINESS_STATUSES,
  BUSINESS_STATUS_LABEL,
  type BusinessStatus,
} from '@/schemas/market-entry/input';

/**
 * The business profile form.
 *
 * One page rather than stages: a profile is reference material, edited in
 * passing rather than completed under momentum, and a person updating one
 * field should not walk four screens to reach it.
 *
 * Everything except the name is optional, and the website says so in as many
 * words. Validation is the server's schema; errors come back per field in the
 * same shape the intake uses and land on the field that owns them.
 */

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({
  value: country.code,
  label: country.name,
}));

export interface ProfileFormValues {
  name: string;
  websiteUrl: string;
  description: string;
  homeCountry: string | null;
  industry: string;
  offerings: string[];
  targetCustomers: string[];
  buyerRoles: string[];
  businessModel: BusinessModel | null;
  pricePositioning: PricePosition | null;
  salesChannels: string[];
  tractionStage: BusinessStatus | null;
  teamCapacity: string;
  differentiators: string[];
  constraintsNotes: string;
  goals: string[];
  knownCompetitors: string[];
  customerEvidence: string;
}

export function emptyProfileValues(): ProfileFormValues {
  return {
    name: '',
    websiteUrl: '',
    description: '',
    homeCountry: null,
    industry: '',
    offerings: [],
    targetCustomers: [],
    buyerRoles: [],
    businessModel: null,
    pricePositioning: null,
    salesChannels: [],
    tractionStage: null,
    teamCapacity: '',
    differentiators: [],
    constraintsNotes: '',
    goals: [],
    knownCompetitors: [],
    customerEvidence: '',
  };
}

interface FieldError {
  field: string;
  message: string;
}

/** A stored record, reshaped for the form's controlled inputs. */
export function toProfileFormValues(record: {
  name: string;
  websiteUrl: string | null;
  description: string | null;
  homeCountry: string | null;
  industry: string | null;
  offerings: string[];
  targetCustomers: string[];
  buyerRoles: string[];
  businessModel: BusinessModel | null;
  pricePositioning: PricePosition | null;
  salesChannels: string[];
  tractionStage: BusinessStatus | null;
  teamCapacity: string | null;
  differentiators: string[];
  constraintsNotes: string | null;
  goals: string[];
  knownCompetitors: string[];
  customerEvidence: string | null;
}): ProfileFormValues {
  return {
    name: record.name,
    websiteUrl: record.websiteUrl ?? '',
    description: record.description ?? '',
    homeCountry: record.homeCountry,
    industry: record.industry ?? '',
    offerings: record.offerings,
    targetCustomers: record.targetCustomers,
    buyerRoles: record.buyerRoles,
    businessModel: record.businessModel,
    pricePositioning: record.pricePositioning,
    salesChannels: record.salesChannels,
    tractionStage: record.tractionStage,
    teamCapacity: record.teamCapacity ?? '',
    differentiators: record.differentiators,
    constraintsNotes: record.constraintsNotes ?? '',
    goals: record.goals,
    knownCompetitors: record.knownCompetitors,
    customerEvidence: record.customerEvidence ?? '',
  };
}

export function ProfileForm({
  profileId = null,
  initialValues,
}: {
  /** Present when editing; absent when creating. */
  profileId?: string | null;
  initialValues?: ProfileFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileFormValues>(
    initialValues ?? emptyProfileValues(),
  );
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const set = <K extends keyof ProfileFormValues>(key: K) => {
    return (value: ProfileFormValues[K]) => {
      setValues((previous) => ({ ...previous, [key]: value }));
      setErrors((previous) => previous.filter((error) => error.field !== key));
    };
  };

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message;

  async function save() {
    if (busy) return;
    setBusy(true);
    setFailure(null);

    try {
      const response = await fetch(
        profileId ? `/api/profiles/${profileId}` : '/api/profiles',
        {
          method: profileId ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        },
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const issues = payload?.issues as FieldError[] | undefined;
        if (issues && issues.length > 0) {
          setErrors(issues);
          document.getElementsByName(issues[0]!.field)[0]?.focus();
        } else {
          setFailure(payload?.message ?? 'The profile could not be saved. Try again.');
        }
        return;
      }

      router.push('/profiles');
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
          label="Profile name"
          name="name"
          required
          value={values.name}
          onChange={set('name')}
          hint="Usually the business or project name."
          error={errorFor('name')}
        />

        <TextField
          label="Website"
          name="websiteUrl"
          value={values.websiteUrl}
          onChange={set('websiteUrl')}
          placeholder="Optional — example.com"
          hint="Entirely optional. If you add one, the research may read it as one source among many; a missing or unreachable site never blocks a report."
          error={errorFor('websiteUrl')}
        />

        <TextAreaField
          label="What the business does"
          name="description"
          rows={4}
          value={values.description}
          onChange={set('description')}
          hint="A few sentences. This can prefill the brief's offer description."
          error={errorFor('description')}
        />
      </div>

      <Rule label="Where you operate" className="mt-10" />
      <div className="mt-6 space-y-6">
        <Combobox
          label="Home market"
          name="homeCountry"
          options={COUNTRY_OPTIONS}
          value={values.homeCountry}
          onChange={set('homeCountry')}
          placeholder="Start typing a country"
          error={errorFor('homeCountry')}
        />
        <TextField
          label="Industry or category"
          name="industry"
          value={values.industry}
          onChange={set('industry')}
          placeholder="Speciality food — condiments and seasonings"
          error={errorFor('industry')}
        />
        <RadioCards
          label="Where the business is today"
          name="tractionStage"
          value={values.tractionStage}
          onChange={set('tractionStage')}
          options={BUSINESS_STATUSES.map((status) => ({
            value: status,
            label: BUSINESS_STATUS_LABEL[status],
          }))}
          columns={3}
          error={errorFor('tractionStage')}
        />
      </div>

      <Rule label="What you sell" className="mt-10" />
      <div className="mt-6 space-y-6">
        <ChipInput
          label="Products and services"
          name="offerings"
          value={values.offerings}
          onChange={set('offerings')}
          max={12}
          placeholder="Add a product or service"
          error={errorFor('offerings')}
        />
        <ChipInput
          label="What sets you apart"
          name="differentiators"
          value={values.differentiators}
          onChange={set('differentiators')}
          max={8}
          placeholder="Add a differentiator"
          error={errorFor('differentiators')}
        />
        <RadioCards
          label="How the business sells"
          name="businessModel"
          value={values.businessModel}
          onChange={set('businessModel')}
          options={BUSINESS_MODELS.map((model) => ({
            value: model,
            label: BUSINESS_MODEL_LABEL[model],
          }))}
          columns={2}
          error={errorFor('businessModel')}
        />
        <RadioCards
          label="Price position"
          name="pricePositioning"
          value={values.pricePositioning}
          onChange={set('pricePositioning')}
          options={PRICE_POSITIONS.map((position) => ({
            value: position,
            label: PRICE_POSITION_LABEL[position],
          }))}
          columns={2}
          error={errorFor('pricePositioning')}
        />
      </div>

      <Rule label="Who buys" className="mt-10" />
      <div className="mt-6 space-y-6">
        <ChipInput
          label="Customer groups"
          name="targetCustomers"
          value={values.targetCustomers}
          onChange={set('targetCustomers')}
          max={8}
          placeholder="Add a customer group"
          error={errorFor('targetCustomers')}
        />
        <ChipInput
          label="Buyer roles"
          name="buyerRoles"
          value={values.buyerRoles}
          onChange={set('buyerRoles')}
          max={8}
          placeholder="Head of buying, store owner…"
          error={errorFor('buyerRoles')}
        />
        <ChipInput
          label="Sales channels"
          name="salesChannels"
          value={values.salesChannels}
          onChange={set('salesChannels')}
          max={8}
          placeholder="Farm shops, ecommerce, wholesale…"
          error={errorFor('salesChannels')}
        />
      </div>

      <Rule label="Context for the research" className="mt-10" />
      <div className="mt-6 space-y-6">
        <TextAreaField
          label="Team and capacity"
          name="teamCapacity"
          rows={2}
          value={values.teamCapacity}
          onChange={set('teamCapacity')}
          hint="Who does the work, and how much more it could take on."
          error={errorFor('teamCapacity')}
        />
        <ChipInput
          label="Goals"
          name="goals"
          value={values.goals}
          onChange={set('goals')}
          max={8}
          placeholder="Add a goal"
          error={errorFor('goals')}
        />
        <TextAreaField
          label="Constraints"
          name="constraintsNotes"
          rows={2}
          value={values.constraintsNotes}
          onChange={set('constraintsNotes')}
          hint="Budget ceilings, certifications you lack, capacity limits."
          error={errorFor('constraintsNotes')}
        />
        <ChipInput
          label="Known competitors"
          name="knownCompetitors"
          value={values.knownCompetitors}
          onChange={set('knownCompetitors')}
          max={10}
          placeholder="Add a competitor"
          error={errorFor('knownCompetitors')}
        />
        <TextAreaField
          label="Evidence you already hold"
          name="customerEvidence"
          rows={4}
          value={values.customerEvidence}
          onChange={set('customerEvidence')}
          hint="Facts you can vouch for: trade-show conversations, distributor quotes, your own sales data. Reports label these as customer-provided, distinct from public evidence."
          error={errorFor('customerEvidence')}
        />
      </div>

      {failure && (
        <p role="alert" className="text-copper mt-8 text-[14px] leading-relaxed">
          {failure}
        </p>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : profileId ? 'Save profile' : 'Create profile'}
        </Button>
        <Meta aria-hidden="true">Only the name is required</Meta>
      </div>
    </form>
  );
}
