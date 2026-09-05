import { z } from 'zod';

/**
 * Scenario Lab assumptions.
 *
 * Everything in this schema is the customer's to set, and the product's whole
 * posture depends on keeping that boundary sharp: the report contributes only
 * figures the customer supplied or the research sourced, and the Lab never
 * invents a demand curve, a conversion rate or a market share. A scenario is
 * "what would follow from numbers I chose", not a forecast — the UI says so
 * and the engine's outputs each carry the arithmetic that produced them.
 *
 * Bounds are wide but real: they exist to keep arithmetic in integer-safe
 * ranges, not to opine on what a plausible business looks like.
 */

export const RISK_TOLERANCES = ['conservative', 'base', 'ambitious'] as const;
export type RiskTolerance = (typeof RISK_TOLERANCES)[number];

export const RISK_TOLERANCE_LABEL: Record<RiskTolerance, string> = {
  conservative: 'Conservative',
  base: 'Base',
  ambitious: 'Ambitious',
};

/**
 * Which point of the customer's own demand range each tolerance reads.
 * Choosing within their stated range is the honest version of optimism.
 */
export const RISK_DEMAND_POINT: Record<RiskTolerance, number> = {
  conservative: 0,
  base: 0.5,
  ambitious: 1,
};

const minorUnits = z
  .number({ error: 'Enter an amount' })
  .int({ error: 'Enter an amount' })
  .min(0, { error: 'Enter an amount of zero or more' })
  .max(100_000_000_000, { error: 'That amount is larger than the Lab can use' });

const units = z
  .number({ error: 'Enter a whole number of units' })
  .int({ error: 'Enter a whole number of units' })
  .min(0, { error: 'Enter a whole number of units' })
  .max(100_000_000, { error: 'That quantity is larger than the Lab can use' });

const percent = z
  .number({ error: 'Enter a percentage' })
  .min(0, { error: 'Enter a percentage between 0 and 100' })
  .max(100, { error: 'Enter a percentage between 0 and 100' });

export const scenarioAssumptionsSchema = z
  .object({
    /** Planning horizon. */
    horizonMonths: z
      .number({ error: 'Choose a horizon' })
      .int()
      .min(3, { error: 'Three months is the shortest useful horizon' })
      .max(36, { error: 'Three years is as far as this arithmetic should reach' })
      .default(12),

    /** Selling price per unit, integer minor units. */
    priceMinor: minorUnits.nullable().default(null),
    /** Unit cost, integer minor units. */
    unitCostMinor: minorUnits.nullable().default(null),
    /** Launch budget to recoup, integer minor units. */
    budgetMinor: minorUnits.nullable().default(null),

    /**
     * The demand range the customer believes in, units per month. Explicitly
     * theirs: the Lab refuses to run without it rather than supplying one.
     */
    monthlyDemandLow: units.default(0),
    monthlyDemandHigh: units.default(0),

    /** Share of that demand actually won. */
    conversionPercent: percent.default(70),

    /** Operating ceiling, units per month. Null means unconstrained. */
    capacityUnitsPerMonth: units.nullable().default(null),

    /** Channel mix: what share of volume moves at a discounted trade price. */
    wholesaleSharePercent: percent.default(0),
    wholesaleDiscountPercent: z
      .number({ error: 'Enter a discount percentage' })
      .min(0, { error: 'Enter a discount between 0 and 80' })
      .max(80, { error: 'A discount above 80% is a different business model' })
      .default(30),

    riskTolerance: z
      .enum(RISK_TOLERANCES, { error: 'Choose a risk posture' })
      .default('base'),
  })
  .refine((value) => value.monthlyDemandHigh >= value.monthlyDemandLow, {
    message: 'The high end of the range cannot be below the low end',
    path: ['monthlyDemandHigh'],
  });

export type ScenarioAssumptions = z.infer<typeof scenarioAssumptionsSchema>;

/**
 * The three starting points. Presets set the posture and the conversion
 * assumption; every value remains editable, and none of them touches the
 * demand range — that is the customer's claim to make.
 */
export const SCENARIO_PRESETS: Record<
  RiskTolerance,
  Pick<ScenarioAssumptions, 'riskTolerance' | 'conversionPercent'>
> = {
  conservative: { riskTolerance: 'conservative', conversionPercent: 50 },
  base: { riskTolerance: 'base', conversionPercent: 70 },
  ambitious: { riskTolerance: 'ambitious', conversionPercent: 85 },
};
