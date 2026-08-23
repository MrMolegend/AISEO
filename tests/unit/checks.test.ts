import { describe, expect, it } from 'vitest';
import { computeChecks, TITLE_MAX, DESCRIPTION_MAX } from '@/lib/extraction/checks';
import type { SiteFacts } from '@/schemas/facts';

/**
 * The checks module is the closest thing the product has to an opinion stated as
 * fact, so each threshold is asserted at its boundary rather than in the middle.
 */

type FactsForChecks = Omit<SiteFacts, 'checks'>;

function baseFacts(overrides: Partial<FactsForChecks> = {}): FactsForChecks {
  return {
    fetchedAt: '2026-03-14T00:00:00.000Z',
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    redirectChain: [],
    httpStatus: 200,
    responseTimeMs: 300,
    htmlBytes: 40_000,
    isHttps: true,
    faviconUrl: null,
    meta: {
      title: 'A perfectly reasonable page title here',
      titleLength: 37,
      description: 'A'.repeat(120),
      descriptionLength: 120,
      canonical: 'https://example.com/',
      robotsMeta: null,
      viewport: 'width=device-width, initial-scale=1',
      lang: 'en',
      charset: 'utf-8',
    },
    openGraph: {},
    twitterCard: {},
    headings: { h1: ['Main heading'], h2: [], h3: [] },
    headingCounts: { h1: 1, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    content: { text: 'x', wordCount: 500, truncated: false },
    links: {
      internal: [],
      external: [],
      counts: { internal: 5, external: 1, nofollow: 0, empty: 0 },
    },
    images: {
      sample: [],
      counts: { total: 10, missingAlt: 0, emptyAlt: 0, lazyLoaded: 10 },
    },
    structuredData: { types: ['Organization'], blocks: [], parseErrors: 0 },
    robotsTxt: {
      found: true,
      allowsOurAgent: true,
      sitemapUrls: ['https://example.com/sitemap.xml'],
    },
    sitemapXml: { found: true, url: 'https://example.com/sitemap.xml' },
    technical: {
      hasHreflang: false,
      hasAmp: false,
      inlineStyleCount: 0,
      scriptCount: 2,
      externalScriptCount: 1,
      iframeCount: 0,
      formCount: 1,
      hasHttpResourcesOnHttps: false,
      likelyClientRendered: false,
    },
    ...overrides,
  };
}

const statusOf = (facts: FactsForChecks, id: string) =>
  computeChecks(facts).find((c) => c.id === id)?.status;

describe('computeChecks — a healthy page', () => {
  it('passes every core check', () => {
    const checks = computeChecks(baseFacts());
    const failing = checks.filter((c) => c.status === 'fail');
    expect(
      failing,
      `unexpected failures: ${failing.map((f) => f.id).join(', ')}`,
    ).toEqual([]);
  });
});

describe('computeChecks — title', () => {
  it('fails when absent', () => {
    const facts = baseFacts();
    facts.meta.title = null;
    facts.meta.titleLength = 0;
    expect(statusOf(facts, 'title-present')).toBe('fail');
  });

  it('passes at exactly the display limit and warns one over', () => {
    const at = baseFacts();
    at.meta.titleLength = TITLE_MAX;
    expect(statusOf(at, 'title-present')).toBe('pass');

    const over = baseFacts();
    over.meta.titleLength = TITLE_MAX + 1;
    expect(statusOf(over, 'title-present')).toBe('warn');
  });

  it('warns when very short', () => {
    const facts = baseFacts();
    facts.meta.title = 'Home';
    facts.meta.titleLength = 4;
    expect(statusOf(facts, 'title-present')).toBe('warn');
  });
});

describe('computeChecks — meta description', () => {
  it('fails when absent', () => {
    const facts = baseFacts();
    facts.meta.description = null;
    facts.meta.descriptionLength = 0;
    expect(statusOf(facts, 'meta-description-present')).toBe('fail');
  });

  it('passes at the limit and warns one over', () => {
    const at = baseFacts();
    at.meta.descriptionLength = DESCRIPTION_MAX;
    expect(statusOf(at, 'meta-description-present')).toBe('pass');

    const over = baseFacts();
    over.meta.descriptionLength = DESCRIPTION_MAX + 1;
    expect(statusOf(over, 'meta-description-present')).toBe('warn');
  });
});

describe('computeChecks — headings', () => {
  it.each([
    [0, 'fail'],
    [1, 'pass'],
    [2, 'warn'],
    [7, 'warn'],
  ] as const)('reports %i H1 elements as %s', (count, expected) => {
    const facts = baseFacts();
    facts.headingCounts.h1 = count;
    expect(statusOf(facts, 'h1-count')).toBe(expected);
  });
});

describe('computeChecks — technical fundamentals', () => {
  it.each([
    [
      'canonical-present',
      (f: FactsForChecks): void => {
        f.meta.canonical = null;
      },
    ],
    [
      'viewport-present',
      (f: FactsForChecks): void => {
        f.meta.viewport = null;
      },
    ],
    [
      'lang-declared',
      (f: FactsForChecks): void => {
        f.meta.lang = null;
      },
    ],
  ] as const)('fails %s when the value is absent', (id, mutate) => {
    const facts = baseFacts();
    mutate(facts);
    expect(statusOf(facts, id)).toBe('fail');
  });

  it('fails the HTTPS check on an http page', () => {
    expect(statusOf(baseFacts({ isHttps: false }), 'https')).toBe('fail');
  });

  it('only reports mixed content on https pages', () => {
    const secure = baseFacts();
    secure.technical.hasHttpResourcesOnHttps = true;
    expect(statusOf(secure, 'mixed-content')).toBe('fail');

    const insecure = baseFacts({ isHttps: false });
    insecure.technical.hasHttpResourcesOnHttps = true;
    expect(statusOf(insecure, 'mixed-content')).toBeUndefined();
  });
});

describe('computeChecks — images', () => {
  it('reports unknown when a page has no images', () => {
    const facts = baseFacts();
    facts.images.counts = { total: 0, missingAlt: 0, emptyAlt: 0, lazyLoaded: 0 };
    expect(statusOf(facts, 'image-alt-coverage')).toBe('unknown');
  });

  it('warns on a small proportion and fails on a large one', () => {
    const few = baseFacts();
    few.images.counts = { total: 20, missingAlt: 2, emptyAlt: 0, lazyLoaded: 0 };
    expect(statusOf(few, 'image-alt-coverage')).toBe('warn');

    const many = baseFacts();
    many.images.counts = { total: 20, missingAlt: 15, emptyAlt: 0, lazyLoaded: 0 };
    expect(statusOf(many, 'image-alt-coverage')).toBe('fail');
  });
});

describe('computeChecks — content volume', () => {
  it.each([
    [50, 'fail'],
    [99, 'fail'],
    [100, 'warn'],
    [299, 'warn'],
    [300, 'pass'],
  ] as const)('reports %i words as %s', (wordCount, expected) => {
    const facts = baseFacts();
    facts.content.wordCount = wordCount;
    expect(statusOf(facts, 'content-volume')).toBe(expected);
  });
});

describe('computeChecks — speed proxies', () => {
  it.each([
    [200, 'pass'],
    [1_500, 'pass'],
    [1_501, 'warn'],
    [3_000, 'warn'],
    [3_001, 'fail'],
  ] as const)('reports %ims as %s', (responseTimeMs, expected) => {
    expect(statusOf(baseFacts({ responseTimeMs }), 'response-time')).toBe(expected);
  });

  it('flags an oversized HTML document', () => {
    expect(statusOf(baseFacts({ htmlBytes: 400 * 1024 }), 'page-weight')).toBe('fail');
  });
});

describe('computeChecks — structured data and rendering', () => {
  it('fails when no structured data is present', () => {
    const facts = baseFacts();
    facts.structuredData = { types: [], blocks: [], parseErrors: 0 };
    expect(statusOf(facts, 'structured-data')).toBe('fail');
  });

  it('reports a parse failure as its own check', () => {
    const facts = baseFacts();
    facts.structuredData.parseErrors = 2;
    expect(statusOf(facts, 'structured-data-valid')).toBe('fail');
  });

  it('adds a client-rendered check only when the flag is set', () => {
    expect(statusOf(baseFacts(), 'client-rendered')).toBeUndefined();
    const spa = baseFacts();
    spa.technical.likelyClientRendered = true;
    expect(statusOf(spa, 'client-rendered')).toBe('fail');
  });
});

describe('computeChecks — output shape', () => {
  it('caps observed values so a huge title cannot bloat the prompt', () => {
    const facts = baseFacts();
    facts.meta.title = 'x'.repeat(500);
    facts.meta.titleLength = 500;
    for (const check of computeChecks(facts)) {
      expect(check.observed.length).toBeLessThanOrEqual(200);
    }
  });

  it('produces unique check ids', () => {
    const ids = computeChecks(baseFacts()).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
