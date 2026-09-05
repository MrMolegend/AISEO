import type { MarketEntryInput } from '@/schemas/market-entry/input';
import type { MarketEntryReport } from '@/schemas/market-entry/report';
import {
  RISK_DEMAND_POINT,
  type ScenarioAssumptions,
} from '@/schemas/market-entry/scenario-lab';

/**
 * The Scenario Lab's arithmetic.
 *
 * Pure functions over integers, in the same discipline as pricing.ts: a
 * number the customer might act on must be reproducible on a calculator, so
 * every figure this module emits carries the formula that produced it, in
 * words, with the operands shown. A missing input yields a named gap — never
 * an estimate, never a default smuggled in as a result.
 *
 * The one modelling decision worth stating: risk tolerance selects a point
 * WITHIN the customer's own demand range (low end, midpoint, high end). The
 * Lab will cheerfully compute nonsense from nonsense — that is what "your
 * assumptions" means — but it will not supply the nonsense itself.
 */

export interface ComputedFigure {
  /** Integer minor units, whole units, or tenths of a percent ÷ 10. */
  value: number | null;
  /** The arithmetic, written for a person. */
  formula: string;
  /** What was absent when value is null. */
  missingInputs: string[];
}

export interface ScenarioComputation {
  monthlyUnits: ComputedFigure;
  totalUnits: ComputedFigure;
  blendedPriceMinor: ComputedFigure;
  revenueMinor: ComputedFigure;
  grossMarginPerUnitMinor: ComputedFigure;
  grossProfitMinor: ComputedFigure;
  grossMarginPercent: ComputedFigure;
  breakEvenUnits: ComputedFigure;
  monthsToRecoupBudget: ComputedFigure;
  /** True when the capacity ceiling, not demand, set the volume. */
  capacityLimited: boolean;
}

/** What the stored brief and report contribute as starting values. */
export interface ScenarioBase {
  currency: string | null;
  currentPriceMinor: number | null;
  targetPriceMinor: number | null;
  unitCostMinor: number | null;
  launchBudgetMinor: number | null;
  /** The researched shelf-price midpoint, when one was sourced. */
  benchmarkMidpointMinor: number | null;
}

export function scenarioBaseFrom(
  input: MarketEntryInput,
  report: MarketEntryReport,
): ScenarioBase {
  const benchmark = report.scenarios.find(
    (scenario) => scenario.id === 'at-benchmark-midpoint',
  );
  return {
    currency: input.currency,
    currentPriceMinor: input.currentPrice,
    targetPriceMinor: input.targetPrice,
    unitCostMinor: input.unitCost,
    launchBudgetMinor: input.launchBudget,
    benchmarkMidpointMinor: benchmark?.sellingPriceMinor ?? null,
  };
}

/** The assumptions a fresh Lab opens with: the customer's own stored figures. */
export function defaultAssumptionsFrom(base: ScenarioBase): Partial<ScenarioAssumptions> {
  return {
    priceMinor: base.targetPriceMinor ?? base.currentPriceMinor ?? null,
    unitCostMinor: base.unitCostMinor,
    budgetMinor: base.launchBudgetMinor,
  };
}

const gap = (formula: string, missing: string[]): ComputedFigure => ({
  value: null,
  formula,
  missingInputs: missing,
});

function money(minor: number, currency: string | null): string {
  const major = (minor / 100).toFixed(2);
  return currency ? `${major} ${currency}` : major;
}

export function computeScenario(
  base: ScenarioBase,
  assumptions: ScenarioAssumptions,
): ScenarioComputation {
  const {
    horizonMonths,
    priceMinor,
    unitCostMinor,
    budgetMinor,
    monthlyDemandLow,
    monthlyDemandHigh,
    conversionPercent,
    capacityUnitsPerMonth,
    wholesaleSharePercent,
    wholesaleDiscountPercent,
    riskTolerance,
  } = assumptions;

  const currency = base.currency;

  /* ── Volume ──────────────────────────────────────────────────────────── */

  const demandStated = monthlyDemandHigh > 0;
  const point = RISK_DEMAND_POINT[riskTolerance];
  const demandAtPoint = Math.round(
    monthlyDemandLow + (monthlyDemandHigh - monthlyDemandLow) * point,
  );
  const converted = Math.floor((demandAtPoint * conversionPercent) / 100);
  const capped =
    capacityUnitsPerMonth !== null
      ? Math.min(converted, capacityUnitsPerMonth)
      : converted;
  const capacityLimited =
    capacityUnitsPerMonth !== null && converted > capacityUnitsPerMonth;

  const monthlyUnits: ComputedFigure = demandStated
    ? {
        value: capped,
        formula:
          `${demandAtPoint} units/month (the ${riskTolerance} point of your ` +
          `${monthlyDemandLow}–${monthlyDemandHigh} range) × ${conversionPercent}% conversion` +
          (capacityLimited
            ? `, capped at your ${capacityUnitsPerMonth} units/month capacity`
            : ''),
        missingInputs: [],
      }
    : gap('demand range × conversion, capped at capacity', [
        'Monthly demand range — your assumption to make, not ours',
      ]);

  const totalUnits: ComputedFigure =
    monthlyUnits.value === null
      ? gap('monthly units × horizon', monthlyUnits.missingInputs)
      : {
          value: monthlyUnits.value * horizonMonths,
          formula: `${monthlyUnits.value} units/month × ${horizonMonths} months`,
          missingInputs: [],
        };

  /* ── Price and margin ────────────────────────────────────────────────── */

  const blendedPriceMinor: ComputedFigure =
    priceMinor === null
      ? gap('price × (direct share + wholesale share × (1 − discount))', [
          'Selling price',
        ])
      : {
          value: Math.round(
            (priceMinor * (100 - wholesaleSharePercent) +
              priceMinor *
                wholesaleSharePercent *
                ((100 - wholesaleDiscountPercent) / 100)) /
              100,
          ),
          formula:
            wholesaleSharePercent > 0
              ? `${money(priceMinor, currency)} × (${100 - wholesaleSharePercent}% direct ` +
                `+ ${wholesaleSharePercent}% wholesale at ${wholesaleDiscountPercent}% off)`
              : `${money(priceMinor, currency)}, all direct`,
          missingInputs: [],
        };

  const grossMarginPerUnitMinor: ComputedFigure =
    blendedPriceMinor.value === null || unitCostMinor === null
      ? gap('blended price − unit cost', [
          ...(blendedPriceMinor.value === null ? ['Selling price'] : []),
          ...(unitCostMinor === null ? ['Unit cost'] : []),
        ])
      : {
          value: blendedPriceMinor.value - unitCostMinor,
          formula: `${money(blendedPriceMinor.value, currency)} − ${money(unitCostMinor, currency)}`,
          missingInputs: [],
        };

  const grossMarginPercent: ComputedFigure =
    grossMarginPerUnitMinor.value === null || !blendedPriceMinor.value
      ? gap('margin per unit ÷ blended price', grossMarginPerUnitMinor.missingInputs)
      : {
          // Tenths, computed in integers then divided once, as pricing.ts does.
          value:
            Math.round((grossMarginPerUnitMinor.value / blendedPriceMinor.value) * 1000) /
            10,
          formula: `${money(grossMarginPerUnitMinor.value, currency)} ÷ ${money(blendedPriceMinor.value, currency)}`,
          missingInputs: [],
        };

  /* ── Totals ──────────────────────────────────────────────────────────── */

  const revenueMinor: ComputedFigure =
    totalUnits.value === null || blendedPriceMinor.value === null
      ? gap('total units × blended price', [
          ...totalUnits.missingInputs,
          ...blendedPriceMinor.missingInputs,
        ])
      : {
          value: totalUnits.value * blendedPriceMinor.value,
          formula: `${totalUnits.value} units × ${money(blendedPriceMinor.value, currency)}`,
          missingInputs: [],
        };

  const grossProfitMinor: ComputedFigure =
    totalUnits.value === null || grossMarginPerUnitMinor.value === null
      ? gap('total units × margin per unit', [
          ...totalUnits.missingInputs,
          ...grossMarginPerUnitMinor.missingInputs,
        ])
      : {
          value: totalUnits.value * grossMarginPerUnitMinor.value,
          formula: `${totalUnits.value} units × ${money(grossMarginPerUnitMinor.value, currency)}`,
          missingInputs: [],
        };

  /* ── The budget question ─────────────────────────────────────────────── */

  const breakEvenUnits: ComputedFigure =
    budgetMinor === null ||
    grossMarginPerUnitMinor.value === null ||
    grossMarginPerUnitMinor.value <= 0
      ? gap('budget ÷ margin per unit', [
          ...(budgetMinor === null ? ['Launch budget'] : []),
          ...(grossMarginPerUnitMinor.value === null
            ? grossMarginPerUnitMinor.missingInputs
            : grossMarginPerUnitMinor.value <= 0
              ? ['A positive margin — at these numbers each sale loses money']
              : []),
        ])
      : {
          value: Math.ceil(budgetMinor / grossMarginPerUnitMinor.value),
          formula: `${money(budgetMinor, currency)} ÷ ${money(grossMarginPerUnitMinor.value, currency)} margin, rounded up`,
          missingInputs: [],
        };

  const monthsToRecoupBudget: ComputedFigure =
    breakEvenUnits.value === null || !monthlyUnits.value
      ? gap('break-even units ÷ monthly units', [
          ...breakEvenUnits.missingInputs,
          ...(monthlyUnits.value ? [] : ['Monthly volume above zero']),
        ])
      : {
          // Tenths of a month.
          value: Math.round((breakEvenUnits.value / monthlyUnits.value) * 10) / 10,
          formula: `${breakEvenUnits.value} units ÷ ${monthlyUnits.value} units/month`,
          missingInputs: [],
        };

  return {
    monthlyUnits,
    totalUnits,
    blendedPriceMinor,
    revenueMinor,
    grossMarginPerUnitMinor,
    grossProfitMinor,
    grossMarginPercent,
    breakEvenUnits,
    monthsToRecoupBudget,
    capacityLimited,
  };
}
