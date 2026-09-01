import type { z } from 'zod';
import type { scenarioSchema } from '@/schemas/market-entry/report';
import type { MarketEntryInput } from '@/schemas/market-entry/input';

export type Scenario = z.infer<typeof scenarioSchema>;

/**
 * Margin scenarios, computed rather than written.
 *
 * Everything here is integer arithmetic on minor units. Not because pennies
 * matter at this scale, but because a margin the customer can reproduce on a
 * calculator is a margin they can trust, and floating-point drift in a number
 * someone is about to quote to a distributor is a bad way to lose their
 * confidence.
 *
 * The rule that shapes the whole module: **a missing input produces a missing
 * scenario, never a plausible one.** If they did not tell us their unit cost,
 * there is no honest way to compute a margin, and the correct output is a named
 * gap. This is the single easiest place in the product to invent a number that
 * looks authoritative, so it is the one place with no model involvement at all.
 */

function grossMargin(
  sellingPriceMinor: number | null,
  unitCostMinor: number | null,
): { marginMinor: number | null; marginPercent: number | null } {
  if (sellingPriceMinor === null || unitCostMinor === null) {
    return { marginMinor: null, marginPercent: null };
  }
  const marginMinor = sellingPriceMinor - unitCostMinor;
  if (sellingPriceMinor === 0) return { marginMinor, marginPercent: null };
  // One decimal place, computed in integers then divided, so the same inputs
  // always produce the same digit.
  const marginPercent = Math.round((marginMinor / sellingPriceMinor) * 1000) / 10;
  return { marginMinor, marginPercent };
}

/**
 * Builds the scenarios a report can honestly show.
 *
 * Two of the three come straight from the customer's own figures. The third is
 * deliberately absent unless the research found a sourced benchmark range —
 * "what you would make at the market's midpoint" is only meaningful if the
 * midpoint came from somewhere, and a midpoint the model guessed would be the
 * most dangerous number on the page.
 */
export function buildScenarios(
  input: MarketEntryInput,
  benchmark?: { midpointMinor: number; currency: string } | null,
): Scenario[] {
  const currency = input.currency;
  if (currency === null) {
    // No currency means every amount they entered is a bare digit. Nothing here
    // can be computed, and saying so is the whole output.
    return [];
  }

  const scenarios: Scenario[] = [];

  const named = (
    id: Scenario['id'],
    label: string,
    sellingPriceMinor: number | null,
    missingLabel: string,
    note: string | null,
  ): Scenario => {
    const { marginMinor, marginPercent } = grossMargin(sellingPriceMinor, input.unitCost);
    const missingInputs: string[] = [];
    if (sellingPriceMinor === null) missingInputs.push(missingLabel);
    if (input.unitCost === null) missingInputs.push('Estimated unit cost');

    return {
      id,
      label,
      currency,
      sellingPriceMinor,
      unitCostMinor: input.unitCost,
      grossMarginMinor: marginMinor,
      grossMarginPercent: marginPercent,
      missingInputs,
      note,
    };
  };

  scenarios.push(
    named(
      'at-current-price',
      'At your current price',
      input.currentPrice,
      'Current selling price',
      'Your existing price, before any freight, duty or distributor margin in the new market.',
    ),
  );

  scenarios.push(
    named(
      'at-target-price',
      'At your target price',
      input.targetPrice,
      'Preferred target price',
      'The price you said you would like to achieve.',
    ),
  );

  if (benchmark && benchmark.currency === currency) {
    scenarios.push(
      named(
        'at-benchmark-midpoint',
        'At the researched midpoint',
        benchmark.midpointMinor,
        'Researched benchmark',
        'The midpoint of the price range found in the research. A shelf price, not an ex-works price — the difference is distributor and retailer margin.',
      ),
    );
  }

  return scenarios;
}

/** Which inputs the pricing section could not work without. For the gap list. */
export function missingPricingInputs(input: MarketEntryInput): string[] {
  const missing: string[] = [];
  if (input.currency === null) missing.push('Currency');
  if (input.unitCost === null) missing.push('Estimated unit cost');
  if (input.currentPrice === null) missing.push('Current selling price');
  if (input.targetPrice === null) missing.push('Preferred target price');
  if (input.launchBudget === null) missing.push('Launch budget');
  return missing;
}
