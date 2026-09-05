import { describe, it, expect } from 'vitest';
import {
  computeScenario,
  scenarioBaseFrom,
  defaultAssumptionsFrom,
  type ScenarioBase,
} from '@/lib/market-entry/scenario-lab';
import {
  scenarioAssumptionsSchema,
  SCENARIO_PRESETS,
} from '@/schemas/market-entry/scenario-lab';
import { EXAMPLE_DOSSIER } from '@/fixtures/market-entry/example-dossier';
import { storedMarketEntryInputSchema } from '@/schemas/market-entry/input';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';
import { marketEntryInputSchema } from '@/schemas/market-entry/input';

/**
 * The Scenario Lab's promises: deterministic integer arithmetic, a formula on
 * every figure, a named gap for every missing input, and no invented number
 * anywhere — the engine computes from the customer's assumptions or refuses.
 */

const BASE: ScenarioBase = {
  currency: 'EUR',
  currentPriceMinor: 890, // €8.90
  targetPriceMinor: 1200, // €12.00
  unitCostMinor: 400, // €4.00
  launchBudgetMinor: 500_000, // €5,000
  benchmarkMidpointMinor: 1100,
};

function assume(overrides: Record<string, unknown> = {}) {
  return scenarioAssumptionsSchema.parse({
    priceMinor: 1200,
    unitCostMinor: 400,
    budgetMinor: 500_000,
    monthlyDemandLow: 100,
    monthlyDemandHigh: 300,
    conversionPercent: 50,
    horizonMonths: 12,
    ...overrides,
  });
}

describe('computeScenario', () => {
  it('computes the base case with checkable arithmetic', () => {
    const result = computeScenario(BASE, assume());

    // Midpoint of 100–300 is 200; 50% conversion → 100 units/month.
    expect(result.monthlyUnits.value).toBe(100);
    expect(result.totalUnits.value).toBe(1200);
    // All direct: blended price is the price.
    expect(result.blendedPriceMinor.value).toBe(1200);
    expect(result.grossMarginPerUnitMinor.value).toBe(800);
    expect(result.grossMarginPercent.value).toBe(66.7);
    expect(result.revenueMinor.value).toBe(1200 * 1200);
    expect(result.grossProfitMinor.value).toBe(1200 * 800);
    // €5,000 budget ÷ €8 margin = 625 units; ÷ 100 units/month = 6.3 months.
    expect(result.breakEvenUnits.value).toBe(625);
    expect(result.monthsToRecoupBudget.value).toBe(6.3);
    expect(result.capacityLimited).toBe(false);

    // Every figure carries its own arithmetic.
    expect(result.monthlyUnits.formula).toContain('50% conversion');
    expect(result.breakEvenUnits.formula).toContain('rounded up');
  });

  it('is deterministic', () => {
    const first = computeScenario(BASE, assume());
    const second = computeScenario(BASE, assume());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('risk tolerance reads the customer’s own range, never beyond it', () => {
    const conservative = computeScenario(
      BASE,
      assume({ riskTolerance: 'conservative', conversionPercent: 100 }),
    );
    const base = computeScenario(
      BASE,
      assume({ riskTolerance: 'base', conversionPercent: 100 }),
    );
    const ambitious = computeScenario(
      BASE,
      assume({ riskTolerance: 'ambitious', conversionPercent: 100 }),
    );

    expect(conservative.monthlyUnits.value).toBe(100);
    expect(base.monthlyUnits.value).toBe(200);
    expect(ambitious.monthlyUnits.value).toBe(300);
    // The ambitious case is the top of THEIR range — not a multiplier on it.
    expect(ambitious.monthlyUnits.value).toBeLessThanOrEqual(300);
  });

  it('caps volume at stated capacity and says so', () => {
    const result = computeScenario(
      BASE,
      assume({ capacityUnitsPerMonth: 60, conversionPercent: 100 }),
    );
    expect(result.monthlyUnits.value).toBe(60);
    expect(result.capacityLimited).toBe(true);
    expect(result.monthlyUnits.formula).toContain('capped');
  });

  it('blends wholesale share at the stated discount', () => {
    const result = computeScenario(
      BASE,
      assume({ wholesaleSharePercent: 50, wholesaleDiscountPercent: 40 }),
    );
    // 50% at 12.00 + 50% at 7.20 → 9.60.
    expect(result.blendedPriceMinor.value).toBe(960);
  });

  it('a missing input is a named gap, never a number', () => {
    const noDemand = computeScenario(
      BASE,
      assume({ monthlyDemandLow: 0, monthlyDemandHigh: 0 }),
    );
    expect(noDemand.monthlyUnits.value).toBeNull();
    expect(noDemand.monthlyUnits.missingInputs.join(' ')).toMatch(/your assumption/i);
    expect(noDemand.revenueMinor.value).toBeNull();

    const noCost = computeScenario(BASE, assume({ unitCostMinor: null }));
    expect(noCost.grossMarginPerUnitMinor.value).toBeNull();
    expect(noCost.grossMarginPerUnitMinor.missingInputs).toContain('Unit cost');

    const noBudget = computeScenario(BASE, assume({ budgetMinor: null }));
    expect(noBudget.breakEvenUnits.value).toBeNull();
    expect(noBudget.breakEvenUnits.missingInputs).toContain('Launch budget');
  });

  it('a negative margin blocks the recoup figures with an explanation', () => {
    const result = computeScenario(BASE, assume({ priceMinor: 300, unitCostMinor: 400 }));
    expect(result.grossMarginPerUnitMinor.value).toBe(-100);
    expect(result.breakEvenUnits.value).toBeNull();
    expect(result.breakEvenUnits.missingInputs.join(' ')).toMatch(/loses money/);
  });
});

describe('the report’s contribution to the Lab', () => {
  it('derives starting values from the stored brief and report only', () => {
    const input = storedMarketEntryInputSchema.parse(
      marketEntryInputSchema.parse(EXAMPLE_SUBMISSION),
    );
    const base = scenarioBaseFrom(input, EXAMPLE_DOSSIER);

    expect(base.currency).toBe(input.currency);
    expect(base.unitCostMinor).toBe(input.unitCost);
    expect(base.targetPriceMinor).toBe(input.targetPrice);

    const defaults = defaultAssumptionsFrom(base);
    // Defaults never include a demand range: that is the customer's claim.
    expect('monthlyDemandLow' in defaults).toBe(false);
    expect('monthlyDemandHigh' in defaults).toBe(false);
    expect('conversionPercent' in defaults).toBe(false);
  });
});

describe('presets', () => {
  it('set posture and conversion only — never the demand range', () => {
    for (const preset of Object.values(SCENARIO_PRESETS)) {
      const keys = Object.keys(preset);
      expect(keys.sort()).toEqual(['conversionPercent', 'riskTolerance']);
    }
  });
});
