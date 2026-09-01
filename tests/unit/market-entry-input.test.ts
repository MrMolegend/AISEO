import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  marketEntryInputSchema,
  storedMarketEntryInputSchema,
  STAGE_SCHEMAS,
  STAGE_IDS,
  FIELD_STAGE,
} from '@/schemas/market-entry/input';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';

/**
 * The intake, and the promise it makes by omission.
 *
 * The first test in this file is the one that matters most. "We do not ask for
 * your website" is a product promise, and the only thing standing between it
 * and a future field called `siteUrl` is somebody remembering. So it is read
 * off the source file rather than asserted about behaviour: a website field
 * cannot be added back without this failing and someone having to argue for it.
 */

const submit = (overrides: Record<string, unknown> = {}) =>
  marketEntryInputSchema.safeParse({ ...EXAMPLE_SUBMISSION, ...overrides });

describe('no website is ever requested', () => {
  it('has no website-shaped field in the schema', () => {
    const source = readFileSync(
      join(process.cwd(), 'schemas', 'market-entry', 'input.ts'),
      'utf8',
    );

    // Field declarations only: the file's own prose explains why there is no
    // website field, and that sentence must not fail its own test.
    const declarations = source.match(/^\s{2}[a-zA-Z]+:/gm) ?? [];
    const offending = declarations.filter((line) =>
      /website|siteurl|url|domain|homepage/i.test(line),
    );

    expect(
      offending,
      `The intake declares a website-shaped field: ${offending.join(', ')}`,
    ).toEqual([]);
  });

  it('accepts a complete brief that contains no address of any kind', () => {
    const result = submit();
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.success ? result.data : {})).not.toMatch(/https?:\/\//);
  });

  it('ignores a website if one is sent anyway', () => {
    // A stale client, or someone poking at the API. It must not become part of
    // the brief the research is built from.
    const result = submit({ website: 'https://example.com' });
    expect(result.success).toBe(true);
    expect(result.success && 'website' in result.data).toBe(false);
  });
});

describe('validation', () => {
  it('requires a description long enough to research', () => {
    // "Candles" is not a description a market can be researched from, and
    // there is no website to make up the difference.
    const result = submit({ offerDescription: 'We sell candles.' });
    expect(result.success).toBe(false);
  });

  it('refuses a target market the business already operates in', () => {
    const result = submit({ targetCountry: 'IE', targetRegion: null });
    expect(result.success).toBe(false);
  });

  it('allows the same country when a region is named', () => {
    // Regional expansion inside one country is a real market-entry question.
    const result = submit({ targetCountry: 'IE', targetRegion: 'Connacht' });
    expect(result.success).toBe(true);
  });

  it('refuses amounts with no currency to be amounts in', () => {
    const result = submit({ currency: null });
    expect(result.success).toBe(false);
  });

  it('accepts a brief with no financial figures at all', () => {
    const result = submit({
      currency: null,
      currentPrice: null,
      unitCost: null,
      targetPrice: null,
      launchBudget: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown country rather than storing free text', () => {
    expect(submit({ targetCountry: 'Narnia' }).success).toBe(false);
  });
});

describe('money', () => {
  it('stores minor units, so a price is an integer', () => {
    const result = submit({ currentPrice: '8.90' });
    expect(result.success && result.data.currentPrice).toBe(890);
  });

  it('survives the way people actually type money', () => {
    for (const [typed, expected] of [
      ['£12.50', 1250],
      ['1,250.00', 125000],
      ['  9 ', 900],
    ] as const) {
      const result = submit({ unitCost: typed });
      expect(result.success && result.data.unitCost, typed).toBe(expected);
    }
  });

  it('rejects a typo rather than reading it as free', () => {
    // A price of nothing is a claim, and a slipped keystroke should not make it.
    expect(submit({ unitCost: 'about a fiver' }).success).toBe(false);
  });

  it('treats an empty field as absent, not as zero', () => {
    const result = submit({ targetPrice: '' });
    expect(result.success && result.data.targetPrice).toBeNull();
  });
});

describe('known competitors', () => {
  it('deduplicates case-insensitively', () => {
    const result = submit({
      knownCompetitors: ['Maldon Salt', 'maldon salt', 'Halen Môn'],
    });
    expect(result.success && result.data.knownCompetitors).toEqual([
      'Maldon Salt',
      'Halen Môn',
    ]);
  });

  it('keeps spaces inside a name', () => {
    const result = submit({ knownCompetitors: ['Fleur de Sel de Guérande'] });
    expect(result.success && result.data.knownCompetitors[0]).toBe(
      'Fleur de Sel de Guérande',
    );
  });

  it('refuses more than ten', () => {
    const eleven = Array.from({ length: 11 }, (_, index) => `Brand ${index}`);
    expect(submit({ knownCompetitors: eleven }).success).toBe(false);
  });
});

describe('stage schemas', () => {
  it('cover every field of the submission, exactly once', () => {
    // Read off a real parse rather than schema internals: `marketEntryInputSchema`
    // is an object wrapped in two `.refine()` calls, so its `_def` is a Zod
    // implementation detail that has already moved once between versions.
    const parsed = marketEntryInputSchema.safeParse(EXAMPLE_SUBMISSION);
    expect(parsed.success, 'the example submission must parse').toBe(true);
    const submissionFields = new Set(parsed.success ? Object.keys(parsed.data) : []);
    const stageFields = STAGE_IDS.flatMap((stage) =>
      Object.keys(STAGE_SCHEMAS[stage].shape),
    );

    expect(new Set(stageFields).size, 'a field appears in two stages').toBe(
      stageFields.length,
    );

    for (const field of stageFields) {
      expect(FIELD_STAGE[field], `${field} has no owning stage`).toBeDefined();
    }
    // packageId is the only submission field no stage collects.
    for (const field of submissionFields) {
      if (field === 'packageId') continue;
      expect(stageFields, `${field} is collected by no stage`).toContain(field);
    }
  });

  it('routes every field back to the stage that collected it', () => {
    // Without this a server-side field error renders on a stage nobody is
    // looking at, which on a four-stage form is the same as not rendering.
    expect(FIELD_STAGE.offerDescription).toBe('offer');
    expect(FIELD_STAGE.targetCountry).toBe('target');
    expect(FIELD_STAGE.unitCost).toBe('commercial');
    expect(FIELD_STAGE.keyQuestion).toBe('objectives');
  });

  it('validates a stage without needing the other three', () => {
    // What the form does between stages. A stage that could only be checked as
    // part of the whole submission could not be checked at all until the end.
    const stage = STAGE_SCHEMAS.target.safeParse({
      targetCountry: 'AE',
      targetRegion: 'Dubai',
      routeToMarket: 'distributor',
      intendedCustomer: 'retailer',
      customerDescription: 'Premium grocery category managers in Dubai and Abu Dhabi.',
      marketReason: 'Two hotel groups approached us at a trade show last spring.',
    });
    expect(stage.success).toBe(true);
  });
});

describe('reading a brief back out of storage', () => {
  /*
   * The submission schema's money field is a transform, not a check: it
   * multiplies by a hundred to reach integer minor units. Running it over an
   * already-stored brief therefore multiplies again, and the runner does
   * exactly that re-validation on the row it loads.
   *
   * It was doing it with the wrong schema, and the effect was invisible: a
   * customer's €8.90 shelf price reached the model, the pricing section and
   * every margin scenario as €890. Nothing failed, nothing looked odd, and the
   * only thing wrong with the report was all of its numbers.
   */
  const stored = () => marketEntryInputSchema.parse(EXAMPLE_SUBMISSION);

  it('leaves the amounts exactly as they were stored', () => {
    const first = stored();
    const second = storedMarketEntryInputSchema.parse(first);

    expect(second.currentPrice).toBe(first.currentPrice);
    expect(second.unitCost).toBe(first.unitCost);
    expect(second.targetPrice).toBe(first.targetPrice);
    expect(second.launchBudget).toBe(first.launchBudget);
  });

  it('is a fixed point — re-reading it any number of times changes nothing', () => {
    let brief = storedMarketEntryInputSchema.parse(stored());
    for (let pass = 0; pass < 4; pass += 1) {
      brief = storedMarketEntryInputSchema.parse(brief);
    }
    expect(brief.currentPrice).toBe(890);
    expect(brief.unitCost).toBe(310);
  });

  it('still rejects a row that is not a valid brief', () => {
    // It is a re-validation, not a rubber stamp: a corrupt row must not reach
    // the model just because it came from our own database.
    expect(
      storedMarketEntryInputSchema.safeParse({ ...stored(), targetCountry: 'ZZ' })
        .success,
    ).toBe(false);
    expect(
      storedMarketEntryInputSchema.safeParse({ ...stored(), currency: null }).success,
    ).toBe(false);
  });

  it('refuses an amount that is not already in minor units', () => {
    expect(
      storedMarketEntryInputSchema.safeParse({ ...stored(), unitCost: '3.10' }).success,
    ).toBe(false);
    expect(
      storedMarketEntryInputSchema.safeParse({ ...stored(), unitCost: 3.1 }).success,
    ).toBe(false);
  });
});

describe('error messages are written for a customer', () => {
  /*
   * The intake routes a field error onto the stage that collected it and shows
   * it under the field. That makes every message customer-facing, and Zod's
   * defaults are accurate and unusable — "Invalid input: expected string,
   * received undefined" under a country selector, or an enum error that prints
   * its own member list back at the reader.
   *
   * This walks every field of every stage, gives it something invalid, and
   * reads what a person would see.
   */
  const INTERNAL = [
    /expected .*received/i,
    /invalid input/i,
    /invalid option/i,
    /invalid enum/i,
    /^expected/i,
    /\bundefined\b/,
    /\bNaN\b/,
    /ZodError/,
    /"[a-z-]+"\|"/,
  ];

  function messagesFor(value: unknown): string[] {
    const result = marketEntryInputSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((issue) => issue.message);
  }

  it('says something human when a required answer is missing', () => {
    const fields = Object.keys(
      marketEntryInputSchema.parse(EXAMPLE_SUBMISSION),
    ) as (keyof typeof EXAMPLE_SUBMISSION)[];

    for (const field of fields) {
      if (field === 'packageId') continue;
      const without = { ...EXAMPLE_SUBMISSION };
      delete without[field];

      for (const message of messagesFor(without)) {
        for (const pattern of INTERNAL) {
          expect(message, `omitting ${String(field)} produced "${message}"`).not.toMatch(
            pattern,
          );
        }
      }
    }
  });

  it('says something human when an answer is the wrong kind of thing', () => {
    const junk: Record<string, unknown> = {
      originCountry: 'Atlantis',
      targetCountry: 42,
      businessStatus: 'thriving',
      routeToMarket: 'telepathy',
      intendedCustomer: {},
      currency: 'GOLD',
      launchTimeframe: 'someday',
      minimumOrderQuantity: 'lots',
      unitCost: 'about a fiver',
      knownCompetitors: Array.from({ length: 14 }, (_, i) => `Brand ${i}`),
      businessName: '',
      offerDescription: 'salt',
    };

    for (const [field, value] of Object.entries(junk)) {
      const messages = messagesFor({ ...EXAMPLE_SUBMISSION, [field]: value });
      expect(messages.length, `${field} was accepted`).toBeGreaterThan(0);

      for (const message of messages) {
        for (const pattern of INTERNAL) {
          expect(message, `${field} produced "${message}"`).not.toMatch(pattern);
        }
        // A message a person can act on starts with a word, not a type name.
        expect(message[0]).toMatch(/[A-Z]/);
      }
    }
  });
});
