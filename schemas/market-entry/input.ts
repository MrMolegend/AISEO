import { z } from 'zod';
import { isCountryCode, isCurrencyCode } from '@/config/markets';
import { MARKET_ENTRY_PACKAGE_ID } from '@/config/report';

/**
 * What the four-stage intake collects.
 *
 * Three rules run through all of it.
 *
 *   **No website address, anywhere.** Not optional, not hidden, not derived.
 *   The previous product asked for one and crawled it, which meant a business
 *   without a website could not be researched and a business with a bad one was
 *   researched badly. What a company sells is something they can describe in a
 *   sentence; making them prove it with a URL was never the right question.
 *   tests/unit/market-entry-input.test.ts fails if a website-shaped field ever
 *   reappears in this file.
 *
 *   **Free text is capped and trimmed.** Every one of these fields ends up
 *   inside a prompt. An unbounded field is both a cost problem and the obvious
 *   place to attempt an injection. The caps here are the first bound; the nonce
 *   wrapping in the prompt builder is the second, and output validation is the
 *   third.
 *
 *   **Money is stored in minor units as integers.** A user types "12.50" and
 *   this schema stores 1250. Floating-point pounds are how margin bugs start,
 *   and every figure here feeds a scenario the customer may act on.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value.replace(/\s+/g, ' ')))
    .nullable()
    .default(null);

const requiredText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((value) => value.replace(/\s+/g, ' '));

const countryCode = z.string().trim().toUpperCase().refine(isCountryCode, {
  message: 'Choose a country from the list',
});

/**
 * An amount of money, as the customer typed it, stored as integer minor units.
 *
 * Accepts a number or a string so the form can stay a plain text input — people
 * type "1,250.00" and "£12.50" and both should work rather than silently
 * becoming null. Anything that is not a number after cleaning is rejected
 * rather than coerced to zero: a price of nothing is a claim, and a typo should
 * not make it.
 */
const money = z
  .union([z.number(), z.string()])
  .nullable()
  .default(null)
  .transform((value, ctx) => {
    if (value === null) return null;
    if (typeof value === 'string' && value.trim().length === 0) return null;

    /*
     * Strip the currency symbols and thousands separators people type, then
     * insist on something that was actually a number.
     *
     * `Number('')` is 0, so cleaning "about a fiver" down to an empty string
     * and coercing it would store a unit cost of nothing — and a cost price of
     * zero is not a missing figure, it is a claim that the product is free,
     * which then flows straight into a margin the customer might quote.
     */
    const stripped =
      typeof value === 'number' ? String(value) : value.replace(/[^\d.-]/g, '');
    if (!/\d/.test(stripped)) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount, for example 12.50' });
      return z.NEVER;
    }

    const cleaned = Number(stripped);

    if (!Number.isFinite(cleaned) || cleaned < 0) {
      ctx.addIssue({ code: 'custom', message: 'Enter an amount, for example 12.50' });
      return z.NEVER;
    }
    if (cleaned > 1_000_000_000) {
      ctx.addIssue({ code: 'custom', message: 'That amount is larger than we can use' });
      return z.NEVER;
    }
    return Math.round(cleaned * 100);
  });

/* ─────────────────────────── Stage 1: the offer ──────────────────────────── */

export const BUSINESS_STATUSES = ['idea', 'trading', 'established'] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

export const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  idea: 'Idea or pre-launch',
  trading: 'Currently trading',
  established: 'Established business',
};

export const offerStageSchema = z.object({
  businessName: requiredText(2, 200),
  productName: requiredText(2, 200),
  /**
   * The single most important field in the form.
   *
   * Everything downstream — the query plan, the competitor search, the
   * regulatory search — is built from this sentence, because there is no
   * website to read instead. The minimum length is not arbitrary: "candles" is
   * not a description a market can be researched from.
   */
  offerDescription: requiredText(40, 1400),
  category: requiredText(2, 160),
  originCountry: countryCode,
  businessStatus: z.enum(BUSINESS_STATUSES),
  supplyArrangements: optionalText(800),
  productCharacteristics: optionalText(800),
});

/* ──────────────────────── Stage 2: the target market ─────────────────────── */

export const ROUTES_TO_MARKET = [
  'wholesale',
  'retail',
  'ecommerce',
  'direct-sales',
  'distributor',
  'mixed',
] as const;
export type RouteToMarket = (typeof ROUTES_TO_MARKET)[number];

export const ROUTE_LABEL: Record<RouteToMarket, string> = {
  wholesale: 'Wholesale',
  retail: 'Retail',
  ecommerce: 'Ecommerce',
  'direct-sales': 'Direct sales',
  distributor: 'Distributor or agent',
  mixed: 'Mixed — not decided yet',
};

export const CUSTOMER_TYPES = [
  'consumer',
  'retailer',
  'distributor',
  'corporate',
  'government',
  'other',
] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  consumer: 'Consumers',
  retailer: 'Retailers',
  distributor: 'Distributors or wholesalers',
  corporate: 'Corporate buyers',
  government: 'Government or public sector',
  other: 'Someone else',
};

export const targetStageSchema = z.object({
  targetCountry: countryCode,
  /** A city, emirate, state or region. Optional — many entries are national. */
  targetRegion: optionalText(160),
  routeToMarket: z.enum(ROUTES_TO_MARKET),
  intendedCustomer: z.enum(CUSTOMER_TYPES),
  customerDescription: requiredText(20, 900),
  /**
   * Why this market.
   *
   * Asked because the answer changes what the research should test. "A
   * distributor approached us" and "it looked big on a chart" are different
   * questions wearing the same clothes.
   */
  marketReason: requiredText(15, 900),
});

/* ────────────────────── Stage 3: commercial context ──────────────────────── */

export const LAUNCH_TIMEFRAMES = [
  'within-3-months',
  'three-to-six-months',
  'six-to-twelve-months',
  'over-a-year',
  'undecided',
] as const;
export type LaunchTimeframe = (typeof LAUNCH_TIMEFRAMES)[number];

export const LAUNCH_TIMEFRAME_LABEL: Record<LaunchTimeframe, string> = {
  'within-3-months': 'Within 3 months',
  'three-to-six-months': '3 to 6 months',
  'six-to-twelve-months': '6 to 12 months',
  'over-a-year': 'More than a year away',
  undecided: 'Not decided',
};

/**
 * Every field here is optional, and every one of them is worth having.
 *
 * The report says so on the stage itself rather than silently producing a
 * thinner pricing section: a margin scenario needs a cost price, and there is
 * no honest way to invent one. What this stage must never do is guess — a
 * missing figure produces a stated gap, not a plausible number.
 */
export const commercialStageSchema = z.object({
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isCurrencyCode, { message: 'Choose a currency from the list' })
    .nullable()
    .default(null),
  /** All amounts in integer minor units of `currency`. */
  currentPrice: money,
  unitCost: money,
  targetPrice: money,
  launchBudget: money,
  minimumOrderQuantity: z.coerce
    .number()
    .int()
    .min(0)
    .max(10_000_000)
    .nullable()
    .default(null),
  productionCapacity: optionalText(400),
  launchTimeframe: z.enum(LAUNCH_TIMEFRAMES).default('undecided'),
});

/* ─────────────────── Stage 4: objectives and constraints ─────────────────── */

export const objectivesStageSchema = z.object({
  primaryObjective: requiredText(10, 700),
  biggestConcern: requiredText(10, 700),
  /**
   * Research seeds, not limits.
   *
   * Ten is a cap on the prompt's size, not on how many competitors the report
   * may find. Names are deduplicated case-insensitively by the chip input and
   * again here, because the two run in different places and only one of them is
   * trustworthy.
   */
  knownCompetitors: z
    .array(z.string().trim().min(1).max(120))
    .max(10)
    .default([])
    .transform((names) => {
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const name of names) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(name.replace(/\s+/g, ' '));
      }
      return unique;
    }),
  existingContacts: optionalText(900),
  knownRegulations: optionalText(900),
  additionalContext: optionalText(1200),
  /**
   * The one question they most want answered.
   *
   * Spends one of the twelve searches directly, and is quoted back in the
   * executive verdict. It is the field most likely to make the report feel
   * like it was written for this customer rather than for their category.
   */
  keyQuestion: requiredText(10, 500),
});

/* ─────────────────────────────── The whole ───────────────────────────────── */

export const STAGE_IDS = ['offer', 'target', 'commercial', 'objectives'] as const;
export type StageKey = (typeof STAGE_IDS)[number];

export const STAGE_TITLES: Record<StageKey, string> = {
  offer: 'What you sell',
  target: 'Where you want to go',
  commercial: 'Your commercial position',
  objectives: 'What you need to know',
};

export const STAGE_PURPOSE: Record<StageKey, string> = {
  offer: 'So the research looks for your product, not your category in general.',
  target: 'So findings, regulations and competitors are specific to that market.',
  commercial: 'So pricing and margin work from your real numbers, never invented ones.',
  objectives: 'So the report answers your decision rather than describing a market.',
};

export const STAGE_SCHEMAS = {
  offer: offerStageSchema,
  target: targetStageSchema,
  commercial: commercialStageSchema,
  objectives: objectivesStageSchema,
} as const;

/**
 * Which stage owns each field.
 *
 * Built from the schemas rather than written out, so a field added to a stage
 * cannot be forgotten here — and it matters, because this map is what turns a
 * server-side validation error into "go back to stage 2 and look at the
 * customer description". Without it a field error on a four-stage form is
 * invisible: the message renders on a stage the user is not looking at.
 */
export const FIELD_STAGE: Readonly<Record<string, StageKey>> = Object.freeze(
  Object.fromEntries(
    STAGE_IDS.flatMap((stage) =>
      Object.keys(STAGE_SCHEMAS[stage].shape).map(
        (field) => [field, stage] as [string, StageKey],
      ),
    ),
  ),
);

const wholeBrief = z
  .object({ packageId: z.literal(MARKET_ENTRY_PACKAGE_ID) })
  .extend(offerStageSchema.shape)
  .extend(targetStageSchema.shape)
  .extend(commercialStageSchema.shape)
  .extend(objectivesStageSchema.shape);

export const marketEntryInputSchema = wholeBrief
  .refine(
    (input) => input.targetCountry !== input.originCountry || Boolean(input.targetRegion),
    {
      message:
        'That is the market you already operate in. Choose a different country, or name the region you want to expand into.',
      path: ['targetCountry'],
    },
  )
  .refine(
    (input) =>
      input.currency !== null ||
      [input.currentPrice, input.unitCost, input.targetPrice, input.launchBudget].every(
        (amount) => amount === null,
      ),
    {
      // A number without a currency is not a figure, it is a digit.
      message: 'Choose the currency these amounts are in',
      path: ['currency'],
    },
  );

export type MarketEntryInput = z.infer<typeof marketEntryInputSchema>;

/**
 * The same brief, read back out of storage.
 *
 * Necessary because `money` is a *transform*, not a validation: it multiplies
 * by a hundred to reach integer minor units. Running the submission schema over
 * an already-stored brief therefore does not merely re-check it — it multiplies
 * every amount by a hundred again, turning a €8.90 shelf price into €890 and
 * every margin scenario in the dossier with it. The runner does exactly that
 * re-validation on the row it loads, which is right (a corrupt row should not
 * reach the model), so what it needs is a schema whose money fields are already
 * minor units.
 *
 * Same fields, same cross-field rules, one difference: amounts are read, not
 * converted.
 */
const storedMoney = z.number().int().min(0).max(100_000_000_000).nullable().default(null);

export const storedMarketEntryInputSchema = wholeBrief
  .extend({
    currentPrice: storedMoney,
    unitCost: storedMoney,
    targetPrice: storedMoney,
    launchBudget: storedMoney,
  })
  .refine(
    (input) => input.targetCountry !== input.originCountry || Boolean(input.targetRegion),
    {
      message: 'Stored brief names the same origin and target market',
      path: ['targetCountry'],
    },
  )
  .refine(
    (input) =>
      input.currency !== null ||
      [input.currentPrice, input.unitCost, input.targetPrice, input.launchBudget].every(
        (amount) => amount === null,
      ),
    { message: 'Stored brief has amounts with no currency', path: ['currency'] },
  );

/** The subject of a job, for listings, the cache key and the report header. */
export function subjectOfMarketEntry(input: MarketEntryInput): {
  name: string;
  targetCountry: string;
  originCountry: string;
} {
  return {
    name: `${input.businessName} — ${input.productName}`,
    targetCountry: input.targetCountry,
    originCountry: input.originCountry,
  };
}
