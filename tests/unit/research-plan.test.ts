import { describe, it, expect } from 'vitest';
import { SearchBudget } from '@/lib/research/budget';
import { proposeQueries, planSearches, INVESTIGATION_AREAS } from '@/lib/research/plan';
import { classifySource, geographicRelevanceOf } from '@/lib/research/classify';
import { SEARCH_BUDGET } from '@/config/report';
import { marketEntryInputSchema } from '@/schemas/market-entry/input';
import { EXAMPLE_SUBMISSION } from '@/fixtures/market-entry/case';
import { ALL_FIXTURE_RESULTS } from '@/fixtures/market-entry/search-results';
import { prioritiseForRetrieval } from '@/lib/research/retrieve';

const INPUT = marketEntryInputSchema.parse(EXAMPLE_SUBMISSION);

/**
 * The research plan, and the budget that is allowed to say no.
 *
 * The planner proposing more than the budget can grant is not an accident — it
 * is what makes these tests meaningful. A plan that already fitted would pass
 * every cap test while proving nothing about enforcement.
 */

describe('the search budget', () => {
  it('grants exactly the configured mix and no more', () => {
    const budget = new SearchBudget();
    const granted = planSearches(INPUT, budget);

    expect(granted).toHaveLength(SEARCH_BUDGET.total);
    expect(budget.usage.advanced).toBe(SEARCH_BUDGET.advanced);
    expect(budget.usage.basic).toBe(SEARCH_BUDGET.basic);
    expect(budget.usage.total).toBe(SEARCH_BUDGET.total);
  });

  it('is asked for more than it can give', () => {
    // If this ever stops being true the caps above stop testing anything.
    expect(proposeQueries(INPUT).length).toBeGreaterThan(SEARCH_BUDGET.total);
  });

  it('refuses a deep search once the deep allowance is gone', () => {
    const budget = new SearchBudget();
    for (let taken = 0; taken < SEARCH_BUDGET.advanced; taken += 1) {
      expect(budget.take('advanced')).toBe(true);
    }
    expect(budget.take('advanced')).toBe(false);
    // ...while the basic allowance is untouched. Metering them separately is
    // the point: twelve deep searches is a different bill entirely.
    expect(budget.take('basic')).toBe(true);
  });

  it('refuses everything once the hard total is reached', () => {
    const budget = new SearchBudget({ basic: 50, advanced: 50, total: 3 });
    expect(budget.take('basic')).toBe(true);
    expect(budget.take('advanced')).toBe(true);
    expect(budget.take('basic')).toBe(true);
    expect(budget.take('basic')).toBe(false);
    expect(budget.take('advanced')).toBe(false);
    expect(budget.exhausted).toBe(true);
  });

  it('never downgrades a deep query into a shallow one', () => {
    // Silently substituting a basic search for an advanced one would make the
    // plan's stated priorities untrue.
    const budget = new SearchBudget({ basic: 12, advanced: 0, total: 12 });
    const granted = planSearches(INPUT, budget);
    expect(granted.every((query) => query.depth === 'basic')).toBe(true);
    expect(budget.usage.advanced).toBe(0);
  });
});

describe('what the plan covers', () => {
  it('reaches every investigation area the product promises', () => {
    const granted = planSearches(INPUT, new SearchBudget());
    const covered = new Set(granted.map((query) => query.area));

    for (const area of INVESTIGATION_AREAS) {
      expect(covered.has(area), `no query covers ${area}`).toBe(true);
    }
  });

  it('spends its deep searches on breadth, not on follow-ups', () => {
    const granted = planSearches(INPUT, new SearchBudget());
    const deep = granted.filter((query) => query.depth === 'advanced');

    expect(deep.map((query) => query.area).sort()).toEqual([
      'channels',
      'market-conditions',
      'regulatory',
    ]);
  });

  it('asks the customer their own question', () => {
    const granted = planSearches(INPUT, new SearchBudget());
    const asked = granted.find((query) => query.area === 'key-question');
    expect(asked?.text).toContain('realistic route to shelf');
  });

  it('seeds the competitor query with the names they gave', () => {
    const granted = planSearches(INPUT, new SearchBudget());
    const competitors = granted.find((query) => query.area === 'competitors');
    expect(competitors?.text).toContain('Maldon Salt');
  });

  it('falls back to the category when no competitor was named', () => {
    const bare = marketEntryInputSchema.parse({
      ...EXAMPLE_SUBMISSION,
      knownCompetitors: [],
    });
    const competitors = planSearches(bare, new SearchBudget()).find(
      (query) => query.area === 'competitors',
    );
    expect(competitors?.text).toContain('Speciality food');
  });

  it('weights every query toward the target market', () => {
    for (const query of planSearches(INPUT, new SearchBudget())) {
      expect(query.country).toBe('AE');
    }
  });

  it('never contains the customer as a subject of research', () => {
    // The brief is context, not a research target. Searching for the customer's
    // own business name would spend a paid query proving they exist.
    const granted = planSearches(INPUT, new SearchBudget());
    expect(granted.some((query) => query.text.includes('Ardmore'))).toBe(false);
  });
});

describe('source classification', () => {
  const cases: [string, string][] = [
    ['https://moccae.gov.example/services/food-import-registration', 'regulator'],
    ['https://customs.gov.example/tariff/chapter-25-salt', 'customs'],
    ['https://fcsc.gov.example/publications/food-import-statistics-2025', 'statistical'],
    ['https://dubaichamber.example/insights/retail-buyer-listing-process', 'chamber'],
    ['https://gulfoodtrade.example/guides/routes-to-market-uae', 'industry_publication'],
    ['https://thenationalnews.example/business/uae-gourmet-grocery', 'news'],
    ['https://carrefouruae.example/c/grocery/salt', 'retailer'],
    ['https://uaefoodimporters.example/directory/speciality-food', 'directory'],
    ['https://maldonsalt.example/stockists/middle-east', 'company'],
  ];

  for (const [url, expected] of cases) {
    it(`classifies ${new URL(url).hostname} as ${expected}`, () => {
      expect(classifySource(url, null)).toBe(expected);
    });
  }

  it('does not mistake a brand for a statistics office', () => {
    /*
     * The regression this file exists for.
     *
     * STATISTICAL_HINTS contained 'ons' and 'stat' matched as substrings, so
     * maldonsalt.example and kibsons.example were both classified as national
     * statistics offices. That is not cosmetic: a statistical source is
     * authoritative and may carry a market-size claim on its own, so two
     * consumer brands were being treated as sources a report could quote a
     * market size from.
     */
    expect(classifySource('https://maldonsalt.example/x', null)).not.toBe('statistical');
    expect(classifySource('https://kibsons.example/x', null)).not.toBe('statistical');
  });

  it('does not mistake a directory of importers for a customs authority', () => {
    // CUSTOMS_HINTS contained 'import', which matches any trade content.
    expect(classifySource('https://uaefoodimporters.example/directory', null)).not.toBe(
      'customs',
    );
  });

  it('places every fixture source in a category', () => {
    for (const result of ALL_FIXTURE_RESULTS) {
      expect(classifySource(result.url, result.title), result.url).not.toBe('other');
    }
  });
});

describe('geographic relevance', () => {
  const context = {
    targetCountry: 'AE',
    targetCountryName: 'United Arab Emirates',
    targetRegion: 'Dubai',
    originCountry: 'IE',
    originCountryName: 'Ireland',
  };

  it('recognises the target region by name', () => {
    expect(
      geographicRelevanceOf({
        url: 'https://dubaichamber.example/insights/x',
        title: null,
        ...context,
      }),
    ).toBe('target-market');
  });

  it('recognises the origin market', () => {
    expect(
      geographicRelevanceOf({
        url: 'https://example.test/x',
        title: 'Exporting from Ireland',
        ...context,
      }),
    ).toBe('origin-market');
  });

  it('flags a third country rather than calling it unknown', () => {
    // "We do not know" and "this is about somewhere else" are different, and
    // the second is the one that produces a confidently wrong report.
    expect(
      geographicRelevanceOf({ url: 'https://example.sa/rules', title: null, ...context }),
    ).toBe('other-market');
  });

  it('recognises a regional grouping', () => {
    expect(
      geographicRelevanceOf({
        url: 'https://example.test/gcc-trade',
        title: null,
        ...context,
      }),
    ).toBe('target-region');
  });
});

describe('choosing which sources to spend the retrieval budget on', () => {
  const candidate = (url: string, category: string, score = 0.5) => ({
    url,
    category,
    score,
  });

  it('reads authorities before anything else', () => {
    // The order is the whole point: only a directly-read authority can carry a
    // regulatory or market-size claim, so the budget goes there first.
    const order = prioritiseForRetrieval(
      [
        candidate('https://blog.example/post', 'other', 0.99),
        candidate('https://shop.example/salt', 'retailer', 0.98),
        candidate('https://news.example/story', 'news', 0.97),
        candidate('https://ministry.gov.example/imports', 'official', 0.1),
        candidate('https://regulator.gov.example/rules', 'regulator', 0.1),
      ],
      5,
    );

    expect(order.slice(0, 2)).toEqual([
      'https://ministry.gov.example/imports',
      'https://regulator.gov.example/rules',
    ]);
    expect(order.at(-1)).toBe('https://blog.example/post');
  });

  it('reaches eight organisations before it reads one site twice', () => {
    const order = prioritiseForRetrieval(
      [
        candidate('https://one.gov.example/a', 'official', 0.9),
        candidate('https://one.gov.example/b', 'official', 0.89),
        candidate('https://one.gov.example/c', 'official', 0.88),
        candidate('https://two.gov.example/a', 'official', 0.5),
        candidate('https://three.gov.example/a', 'official', 0.4),
      ],
      5,
    );

    // One page per publisher first, then the seconds. Eight fetches that reach
    // eight organisations beat eight that read one site's sitemap.
    expect(order.slice(0, 3)).toEqual([
      'https://one.gov.example/a',
      'https://two.gov.example/a',
      'https://three.gov.example/a',
    ]);
  });

  it('breaks a tie within a category by the provider’s own relevance', () => {
    const order = prioritiseForRetrieval(
      [
        candidate('https://a.gov.example/x', 'official', 0.2),
        candidate('https://b.gov.example/x', 'official', 0.8),
      ],
      2,
    );
    expect(order[0]).toBe('https://b.gov.example/x');
  });

  it('never returns more than the budget allows', () => {
    const many = Array.from({ length: 40 }, (_, index) =>
      candidate(`https://p${index}.gov.example/x`, 'official', 1 - index / 100),
    );
    expect(prioritiseForRetrieval(many, 8)).toHaveLength(8);
  });

  it('is stable — the same candidates always produce the same order', () => {
    const candidates = [
      candidate('https://a.gov.example/x', 'official', 0.5),
      candidate('https://b.gov.example/x', 'regulator', 0.5),
      candidate('https://c.example/x', 'news', 0.5),
    ];
    const runs = Array.from({ length: 5 }, () =>
      prioritiseForRetrieval(candidates, 3).join('|'),
    );
    expect(new Set(runs).size).toBe(1);
  });
});
