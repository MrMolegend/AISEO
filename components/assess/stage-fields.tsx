'use client';
import { TextField, TextAreaField, RadioCards } from '@/components/ui/field';
import { Combobox } from '@/components/ui/combobox';
import { ChipInput } from '@/components/ui/chip-input';
import { COUNTRIES, CURRENCIES, defaultCurrencyFor } from '@/config/markets';
import {
  BUSINESS_STATUSES,
  BUSINESS_STATUS_LABEL,
  ROUTES_TO_MARKET,
  ROUTE_LABEL,
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABEL,
  LAUNCH_TIMEFRAMES,
  LAUNCH_TIMEFRAME_LABEL,
} from '@/schemas/market-entry/input';

/**
 * The four stages, as fields.
 *
 * Kept apart from the state machine that drives them so that neither file has
 * to be read to change the other — the machine is about validation, saving and
 * submission, and this is about what is being asked and how it is explained.
 *
 * Every stage carries contextual guidance, and most fields carry a worked
 * example. That is the difference between a form that produces a researchable
 * brief and one that produces "candles, UAE": the research plan is built
 * entirely from these answers, because there is no website to read instead.
 */

export type Values = Record<string, unknown>;

interface StageProps {
  values: Values;
  set: (key: string) => (value: unknown) => void;
  errorFor: (field: string) => string | undefined;
}

const text = (values: Values, key: string): string => String(values[key] ?? '');

const COUNTRY_OPTIONS = COUNTRIES.map((country) => ({
  value: country.code,
  label: country.name,
  note: country.region,
}));

const CURRENCY_OPTIONS = CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.name} (${currency.code})`,
  note: currency.symbol,
}));

/* ─────────────────────────── Stage 1: the offer ──────────────────────────── */

export function OfferStage({ values, set, errorFor }: StageProps) {
  return (
    <div className="space-y-6">
      <TextField
        label="Business or brand name"
        name="businessName"
        required
        value={text(values, 'businessName')}
        onChange={set('businessName')}
        error={errorFor('businessName')}
      />

      <TextField
        label="Product or service name"
        name="productName"
        required
        value={text(values, 'productName')}
        onChange={set('productName')}
        error={errorFor('productName')}
        example="Hand-harvested flake sea salt"
      />

      <TextAreaField
        label="What are you selling?"
        name="offerDescription"
        required
        rows={5}
        maxLength={1400}
        value={text(values, 'offerDescription')}
        onChange={set('offerDescription')}
        error={errorFor('offerDescription')}
        hint="The most important answer on the form. Everything the research looks for is built from it — what the product is, who buys it, what makes it different, how it is packaged."
        example="We hand-harvest flake sea salt on the Atlantic coast and pack it in 100g ceramic jars and 1kg catering pouches. Unrefined, no anti-caking agents, sold as a finishing salt to delicatessens and hotel kitchens."
      />

      <TextField
        label="Product or service category"
        name="category"
        required
        value={text(values, 'category')}
        onChange={set('category')}
        error={errorFor('category')}
        hint="How a buyer or a trade directory would file it."
        example="Speciality food — condiments and seasonings"
      />

      <Combobox
        label="Where you operate from"
        name="originCountry"
        required
        options={COUNTRY_OPTIONS}
        value={(values.originCountry as string | null) ?? null}
        onChange={set('originCountry')}
        error={errorFor('originCountry')}
        placeholder="Search countries"
      />

      <RadioCards
        label="Where the business is today"
        name="businessStatus"
        required
        columns={3}
        value={(values.businessStatus as (typeof BUSINESS_STATUSES)[number]) ?? null}
        onChange={set('businessStatus')}
        error={errorFor('businessStatus')}
        options={BUSINESS_STATUSES.map((status) => ({
          value: status,
          label: BUSINESS_STATUS_LABEL[status],
        }))}
      />

      <TextAreaField
        label="How you make and deliver it today"
        name="supplyArrangements"
        rows={3}
        maxLength={800}
        value={text(values, 'supplyArrangements')}
        onChange={set('supplyArrangements')}
        error={errorFor('supplyArrangements')}
        hint="Where it is produced, who ships it, and how far you have shipped before. This changes which routes to market are realistic."
      />

      <TextAreaField
        label="Anything about the product that affects shipping or regulation"
        name="productCharacteristics"
        rows={3}
        maxLength={800}
        value={text(values, 'productCharacteristics')}
        onChange={set('productCharacteristics')}
        error={errorFor('productCharacteristics')}
        example="Ambient, 3-year shelf life, glass packaging that is heavy for its value, no allergens"
      />
    </div>
  );
}

/* ────────────────────── Stage 2: the target market ───────────────────────── */

export function TargetStage({ values, set, errorFor }: StageProps) {
  return (
    <div className="space-y-6">
      <Combobox
        label="Which market do you want to enter?"
        name="targetCountry"
        required
        options={COUNTRY_OPTIONS}
        value={(values.targetCountry as string | null) ?? null}
        onChange={(code) => {
          set('targetCountry')(code);
          // A sensible default the customer can change, offered rather than
          // assumed — a silently wrong currency on a pricing page is worse
          // than an empty one.
          if (code && !values.currency) {
            const suggested = defaultCurrencyFor(code);
            if (suggested) set('currency')(suggested);
          }
        }}
        error={errorFor('targetCountry')}
        placeholder="Search countries"
      />

      <TextField
        label="City, emirate, state or region"
        name="targetRegion"
        value={text(values, 'targetRegion')}
        onChange={set('targetRegion')}
        error={errorFor('targetRegion')}
        hint="Optional, and worth filling in. Retail and distribution often differ sharply within one country."
        example="Dubai"
      />

      <RadioCards
        label="How do you intend to reach the market?"
        name="routeToMarket"
        required
        columns={3}
        value={(values.routeToMarket as (typeof ROUTES_TO_MARKET)[number]) ?? null}
        onChange={set('routeToMarket')}
        error={errorFor('routeToMarket')}
        hint="A preference, not a commitment. The report compares the alternatives and says whether yours is the right one."
        options={ROUTES_TO_MARKET.map((route) => ({
          value: route,
          label: ROUTE_LABEL[route],
        }))}
      />

      <RadioCards
        label="Who is the buyer?"
        name="intendedCustomer"
        required
        columns={3}
        value={(values.intendedCustomer as (typeof CUSTOMER_TYPES)[number]) ?? null}
        onChange={set('intendedCustomer')}
        error={errorFor('intendedCustomer')}
        options={CUSTOMER_TYPES.map((customer) => ({
          value: customer,
          label: CUSTOMER_TYPE_LABEL[customer],
        }))}
      />

      <TextAreaField
        label="Describe that buyer"
        name="customerDescription"
        required
        rows={4}
        maxLength={900}
        value={text(values, 'customerDescription')}
        onChange={set('customerDescription')}
        error={errorFor('customerDescription')}
        example="Speciality-food category managers at premium grocery chains, and executive chefs sourcing finishing ingredients for hotel restaurant groups."
      />

      <TextAreaField
        label="Why this market?"
        name="marketReason"
        required
        rows={3}
        maxLength={900}
        value={text(values, 'marketReason')}
        onChange={set('marketReason')}
        error={errorFor('marketReason')}
        hint="Asked because the answer changes what the research should test. An inbound approach and a hunch are different questions."
        example="Two hotel groups bought from us at a trade show and asked whether we had a distributor there."
      />
    </div>
  );
}

/* ──────────────────── Stage 3: commercial context ────────────────────────── */

export function CommercialStage({ values, set, errorFor }: StageProps) {
  const currency = (values.currency as string | null) ?? null;
  const suffix = currency ? ` (${currency})` : '';

  return (
    <div className="space-y-6">
      <div className="border-cobalt-line bg-cobalt-surface border-l-[3px] p-4">
        <p className="text-text text-[14px] leading-relaxed">
          Every field on this stage is optional, and every one of them changes what the
          report can tell you. Margin scenarios are calculated from your figures — with no
          cost price there is no honest way to produce one, so the report states the gap
          instead of inventing a number.
        </p>
      </div>

      <Combobox
        label="Currency these figures are in"
        name="currency"
        options={CURRENCY_OPTIONS}
        value={currency}
        onChange={set('currency')}
        error={errorFor('currency')}
        placeholder="Search currencies"
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label={`Current selling price${suffix}`}
          name="currentPrice"
          inputMode="decimal"
          value={text(values, 'currentPrice')}
          onChange={set('currentPrice')}
          error={errorFor('currentPrice')}
          hint="Per unit, as you sell it today."
          example="8.90"
        />
        <TextField
          label={`Estimated unit cost${suffix}`}
          name="unitCost"
          inputMode="decimal"
          value={text(values, 'unitCost')}
          onChange={set('unitCost')}
          error={errorFor('unitCost')}
          hint="What one unit costs you to make and pack."
          example="3.10"
        />
        <TextField
          label={`Target price in the new market${suffix}`}
          name="targetPrice"
          inputMode="decimal"
          value={text(values, 'targetPrice')}
          onChange={set('targetPrice')}
          error={errorFor('targetPrice')}
        />
        <TextField
          label={`Budget available for the launch${suffix}`}
          name="launchBudget"
          inputMode="decimal"
          value={text(values, 'launchBudget')}
          onChange={set('launchBudget')}
          error={errorFor('launchBudget')}
          hint="What you could spend before the first order pays anything back."
        />
        <TextField
          label="Minimum order quantity"
          name="minimumOrderQuantity"
          inputMode="numeric"
          value={text(values, 'minimumOrderQuantity')}
          onChange={set('minimumOrderQuantity')}
          error={errorFor('minimumOrderQuantity')}
          hint="The smallest shipment worth making."
        />
      </div>

      <TextAreaField
        label="Production capacity"
        name="productionCapacity"
        rows={2}
        maxLength={400}
        value={text(values, 'productionCapacity')}
        onChange={set('productionCapacity')}
        error={errorFor('productionCapacity')}
        example="About 900kg a month at current staffing"
      />

      <RadioCards
        label="When would you want to launch?"
        name="launchTimeframe"
        columns={3}
        value={(values.launchTimeframe as (typeof LAUNCH_TIMEFRAMES)[number]) ?? null}
        onChange={set('launchTimeframe')}
        error={errorFor('launchTimeframe')}
        options={LAUNCH_TIMEFRAMES.map((timeframe) => ({
          value: timeframe,
          label: LAUNCH_TIMEFRAME_LABEL[timeframe],
        }))}
      />
    </div>
  );
}

/* ─────────────── Stage 4: objectives and constraints ─────────────────────── */

export function ObjectivesStage({ values, set, errorFor }: StageProps) {
  return (
    <div className="space-y-6">
      <TextAreaField
        label="What decision are you trying to make?"
        name="primaryObjective"
        required
        rows={3}
        maxLength={700}
        value={text(values, 'primaryObjective')}
        onChange={set('primaryObjective')}
        error={errorFor('primaryObjective')}
        example="Decide whether to commit to a distributor agreement this year, or spend the same budget deepening our existing accounts."
      />

      <TextAreaField
        label="What worries you most about it?"
        name="biggestConcern"
        required
        rows={3}
        maxLength={700}
        value={text(values, 'biggestConcern')}
        onChange={set('biggestConcern')}
        error={errorFor('biggestConcern')}
        example="That registration and labelling cost more than the first year of orders is worth, and we find out after signing."
      />

      <ChipInput
        label="Competitors or alternatives you already know of"
        name="knownCompetitors"
        value={(values.knownCompetitors as string[] | undefined) ?? []}
        onChange={set('knownCompetitors')}
        error={errorFor('knownCompetitors')}
        placeholder="Add a name"
        hint="Research seeds, not limits — the report looks well beyond these. Spaces are fine; press Enter or a comma after each one."
      />

      <TextAreaField
        label="Any contacts or distribution relationships you already have"
        name="existingContacts"
        rows={3}
        maxLength={900}
        value={text(values, 'existingContacts')}
        onChange={set('existingContacts')}
        error={errorFor('existingContacts')}
      />

      <TextAreaField
        label="Regulations or certifications you already know about"
        name="knownRegulations"
        rows={3}
        maxLength={900}
        value={text(values, 'knownRegulations')}
        onChange={set('knownRegulations')}
        error={errorFor('knownRegulations')}
        hint="Even a partial answer helps the research start in the right place."
      />

      <TextAreaField
        label="Anything else we should know"
        name="additionalContext"
        rows={3}
        maxLength={1200}
        value={text(values, 'additionalContext')}
        onChange={set('additionalContext')}
        error={errorFor('additionalContext')}
      />

      <TextAreaField
        label="The one question you most want answered"
        name="keyQuestion"
        required
        rows={3}
        maxLength={500}
        value={text(values, 'keyQuestion')}
        onChange={set('keyQuestion')}
        error={errorFor('keyQuestion')}
        hint="This is asked as its own research query and answered directly in the report."
        example="Is there a realistic route to shelf for a producer of our size, and what would it actually cost to get there?"
      />
    </div>
  );
}
