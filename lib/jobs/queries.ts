import type { ResearchInput } from '@/schemas/research/inputs';
import type { CrawlOutcome } from '@/lib/crawl/crawler';

/**
 * Turns a brief into search queries.
 *
 * The queries are built here rather than by the model, deliberately. Asking the
 * model to choose searches means a round trip before any research happens, and
 * it makes the number of provider calls — the main variable cost of a job —
 * something the model decides rather than something the budget does.
 *
 * They are also built partly from what the crawl actually found. A company's
 * own headings say what it calls itself, which is usually a better search term
 * than the category the user typed.
 */

export interface ResearchQuery {
  text: string;
  maxResults: number;
  /** ISO 3166-1 alpha-2 where we can infer one, for geographic weighting. */
  country?: string;
}

/**
 * A handful of common market names mapped to country codes.
 *
 * Deliberately small and permissive: the market field is free text because
 * people write "London", "the Midlands" and "DACH", and forcing a country code
 * would make the form worse. An unmapped market still reaches the query as
 * text, which is where most of the geographic signal lives anyway.
 */
const MARKET_CODES: Record<string, string> = {
  'united kingdom': 'GB',
  uk: 'GB',
  britain: 'GB',
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'united states': 'US',
  usa: 'US',
  us: 'US',
  america: 'US',
  canada: 'CA',
  australia: 'AU',
  ireland: 'IE',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  netherlands: 'NL',
  'new zealand': 'NZ',
  india: 'IN',
  singapore: 'SG',
};

export function countryCodeFor(market: string): string | undefined {
  const normalised = market.trim().toLowerCase();
  if (MARKET_CODES[normalised]) return MARKET_CODES[normalised];
  // Someone typing "UK" in a longer phrase still gets the weighting.
  for (const [name, code] of Object.entries(MARKET_CODES)) {
    if (name.length > 3 && normalised.includes(name)) return code;
  }
  return undefined;
}

/** The most descriptive phrases the company uses about itself. */
function selfDescriptors(crawl: CrawlOutcome): string[] {
  const phrases = new Set<string>();

  for (const { facts } of crawl.pages.slice(0, 6)) {
    for (const heading of [...facts.headings.h1, ...facts.headings.h2.slice(0, 3)]) {
      const trimmed = heading.trim();
      // Long headings are marketing sentences; very short ones are navigation.
      if (trimmed.length >= 12 && trimmed.length <= 70) phrases.add(trimmed);
    }
    if (facts.metaDescription && facts.metaDescription.length <= 160) {
      phrases.add(facts.metaDescription);
    }
  }

  return [...phrases].slice(0, 4);
}

export function buildQueries(input: ResearchInput, crawl: CrawlOutcome): ResearchQuery[] {
  const country = countryCodeFor(input.market);
  const descriptors = selfDescriptors(crawl);
  const queries: ResearchQuery[] = [];

  const add = (text: string, maxResults = 8) => {
    const trimmed = text.replace(/\s+/g, ' ').trim();
    if (trimmed.length < 8) return;
    if (queries.some((q) => q.text === trimmed)) return;
    queries.push({ text: trimmed, maxResults, ...(country ? { country } : {}) });
  };

  switch (input.packageId) {
    case 'competitor-intelligence': {
      const what = input.industry ?? descriptors[0] ?? input.companyName;

      add(`${input.companyName} ${input.market} reviews`);
      add(`${what} companies ${input.market}`, 12);
      add(`best ${what} providers ${input.market}`, 12);
      add(`${what} alternatives to ${input.companyName}`, 10);
      // Indirect competitors are the ones companies overlook, so they get a
      // query of their own rather than being hoped for.
      add(`alternatives to hiring a ${what} ${input.market}`, 8);
      for (const known of input.knownCompetitors.slice(0, 4)) {
        add(`${known} pricing`, 6);
        add(`${known} reviews`, 6);
      }
      for (const descriptor of descriptors.slice(0, 2)) {
        add(`${descriptor} ${input.market}`, 8);
      }
      break;
    }

    case 'lead-finder': {
      const industry = input.targetIndustry ?? 'companies';
      const size = input.idealCompanySize ? ` ${input.idealCompanySize}` : '';

      add(`${industry}${size} ${input.market}`, 15);
      add(`${industry} companies ${input.market} directory`, 15);
      add(`${industry} ${input.market} "about us"`, 12);
      add(`fastest growing ${industry} ${input.market}`, 10);
      add(`${industry} ${input.market} hiring`, 10);
      add(`new ${industry} businesses ${input.market}`, 10);
      if (input.audienceType === 'b2b') {
        add(`${industry} ${input.market} suppliers list`, 10);
      }
      break;
    }

    case 'influencer-outreach': {
      const niche = input.niche ?? input.targetCustomer;
      const platformWord = input.platform === 'mixed' ? 'social media' : input.platform;

      add(`${niche} ${platformWord} creators ${input.market}`, 15);
      add(`top ${niche} influencers ${input.market}`, 15);
      add(`${niche} ${platformWord} accounts to follow ${input.market}`, 12);
      add(`${niche} creator collaborations ${input.market}`, 10);
      add(`${niche} ${platformWord} ${input.creatorSize} influencers`, 10);
      add(`${niche} bloggers ${input.market}`, 10);
      break;
    }

    case 'market-pack': {
      const industry = input.industry ?? descriptors[0] ?? input.businessName;

      add(`${input.businessName} ${input.market} reviews`);
      add(`${industry} companies ${input.market}`, 12);
      add(`best ${industry} providers ${input.market}`, 12);
      for (const known of input.knownCompetitors.slice(0, 3)) {
        add(`${known} pricing`, 6);
      }
      add(`${input.targetCustomer} ${input.market}`, 12);
      add(`${industry} customers ${input.market} directory`, 12);
      add(`${industry} ${input.market} hiring`, 8);

      const platformWord = input.platform === 'mixed' ? 'social media' : input.platform;
      add(`${industry} ${platformWord} creators ${input.market}`, 12);
      add(`top ${industry} influencers ${input.market}`, 12);
      break;
    }
  }

  if (input.packageId !== 'market-pack' && 'exclusions' in input && input.exclusions) {
    // Exclusions are applied when ranking rather than as negative search terms:
    // a provider's exclusion syntax is provider-specific, and getting it wrong
    // silently returns nothing.
  }

  return queries;
}
