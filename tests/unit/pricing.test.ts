import { describe, it, expect } from 'vitest';
import { buildScenarios, missingPricingInputs } from '@/lib/market-entry/pricing';
import type { MarketEntryInput } from '@/schemas/market-entry/input';
import { EXAMPLE_INPUT } from '@/fixtures/market-entry/case';

/**
 * Margin scenarios.
 *
 * The failure this file exists to prevent is a plausible number. A margin
 * computed from a unit cost the customer never supplied would look exactly like
 * one they did supply, would be quoted to a distributor, and would be wrong. So
 * the tests are mostly about absence: what happens when a figure is missing.
 */

const input = (overrides: Partial<MarketEntryInput> = {}): MarketEntryInput => ({
  ...EXAMPLE_INPUT,
  ...overrides,
});

describe('missing inputs produce missing scenarios, never plausible ones', () => {
  it('names the gap instead of computing a margin when unit cost is absent', () => {
    const [current] = buildScenarios(input({ unitCost: null }));
    expect(current?.grossMarginMinor).toBeNull();
    expect(current?.grossMarginPercent).toBeNull();
    expect(current?.missingInputs).toContain('Estimated unit cost');
  });

  it('names the gap when the selling price is absent', () => {
    const scenarios = buildScenarios(input({ currentPrice: null }));
    const current = scenarios.find((scenario) => scenario.id === 'at-current-price');
    expect(current?.sellingPriceMinor).toBeNull();
    expect(current?.grossMarginPercent).toBeNull();
    expect(current?.missingInputs).toContain('Current selling price');
  });

  it('produces nothing at all without a currency', () => {
    // Every figure is a bare number without one; there is no honest scenario.
    expect(buildScenarios(input({ currency: null }))).toEqual([]);
  });

  it('never invents a benchmark scenario the research did not find', () => {
    const scenarios = buildScenarios(input());
    expect(scenarios.map((scenario) => scenario.id)).not.toContain(
      'at-benchmark-midpoint',
    );
  });

  it('ignores a benchmark quoted in another currency', () => {
    const scenarios = buildScenarios(input({ currency: 'EUR' }), {
      midpointMinor: 4500,
      currency: 'AED',
    });
    expect(scenarios.map((scenario) => scenario.id)).not.toContain(
      'at-benchmark-midpoint',
    );
  });

  it('adds the benchmark scenario when the research did find one', () => {
    const scenarios = buildScenarios(input({ currency: 'EUR', unitCost: 100 }), {
      midpointMinor: 400,
      currency: 'EUR',
    });
    const benchmark = scenarios.find(
      (scenario) => scenario.id === 'at-benchmark-midpoint',
    );
    expect(benchmark?.grossMarginMinor).toBe(300);
    expect(benchmark?.grossMarginPercent).toBe(75);
  });
});

describe('arithmetic', () => {
  it('is exact in minor units', () => {
    const [current] = buildScenarios(
      input({ currency: 'EUR', unitCost: 187, currentPrice: 499 }),
    );
    expect(current?.grossMarginMinor).toBe(312);
    expect(current?.grossMarginPercent).toBe(62.5);
  });

  it('reports a negative margin rather than hiding it', () => {
    const [current] = buildScenarios(
      input({ currency: 'EUR', unitCost: 600, currentPrice: 499 }),
    );
    expect(current?.grossMarginMinor).toBe(-101);
    expect(current?.grossMarginPercent).toBeLessThan(0);
  });

  it('does not divide by a zero price', () => {
    const [current] = buildScenarios(
      input({ currency: 'EUR', unitCost: 100, currentPrice: 0 }),
    );
    expect(current?.grossMarginPercent).toBeNull();
    expect(Number.isFinite(current?.grossMarginMinor ?? NaN)).toBe(true);
  });

  it('rounds the percentage to one place, identically every time', () => {
    const run = () =>
      buildScenarios(input({ currency: 'EUR', unitCost: 100, currentPrice: 333 }))[0]
        ?.grossMarginPercent;
    const results = Array.from({ length: 5 }, run);
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe(70);
  });

  it('is free of floating-point drift across a range of prices', () => {
    for (let price = 1; price <= 2000; price += 7) {
      const [current] = buildScenarios(
        input({ currency: 'EUR', unitCost: 137, currentPrice: price }),
      );
      expect(current?.grossMarginMinor).toBe(price - 137);
      expect(Number.isInteger(current?.grossMarginMinor)).toBe(true);
    }
  });
});

describe('missingPricingInputs', () => {
  it('is empty when everything was supplied', () => {
    expect(missingPricingInputs(EXAMPLE_INPUT)).toEqual([]);
  });

  it('names every absent figure', () => {
    const missing = missingPricingInputs(
      input({
        currency: null,
        unitCost: null,
        currentPrice: null,
        targetPrice: null,
        launchBudget: null,
      }),
    );
    expect(missing).toEqual([
      'Currency',
      'Estimated unit cost',
      'Current selling price',
      'Preferred target price',
      'Launch budget',
    ]);
  });
});
