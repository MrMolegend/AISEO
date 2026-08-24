/**
 * Research package catalogue — the single source of truth for what can be
 * bought, what it costs and what it is allowed to do.
 *
 * Nothing here may be sent by the browser. A submission names a package by id;
 * the server looks the cost and the limits up in this file. That is the whole
 * reason the catalogue is a module rather than a database table for now: a
 * price the client cannot influence is a price the client cannot forge.
 *
 * The limits are equally load-bearing. They bound the crawler, the search
 * provider and the model budget, so "how expensive can one job get" has an
 * answer you can read rather than estimate.
 */

import { PlatformError } from '@/lib/errors';

export const RESEARCH_PACKAGE_IDS = [
  'competitor-intelligence',
  'lead-finder',
  'influencer-outreach',
  'market-pack',
] as const;

export type ResearchPackageId = (typeof RESEARCH_PACKAGE_IDS)[number];

/** Which report sections a package produces. Drives rendering and CSV exports. */
export type ResearchModule = 'competitors' | 'leads' | 'influencers' | 'strategy';

export interface PackageLimits {
  /** Ranked competitors in the output. */
  maxCompetitors: number;
  /** Ranked company leads in the output. */
  maxLeads: number;
  /** Ranked creators in the output. */
  maxInfluencers: number;
  /** Search-provider queries across the whole job. */
  maxSearchQueries: number;
  /** Distinct URLs entered into the source registry. */
  maxSources: number;
  /** Pages fetched from the submitted company's own site. */
  maxOwnSitePages: number;
  /** Pages fetched from any single third-party site. */
  maxPagesPerExternalSite: number;
  /** Decoded bytes across every page fetched for the job. */
  maxTotalCrawlBytes: number;
  /** Wall-clock ceiling for the crawl stage. */
  maxCrawlMs: number;
  /** Characters of research context handed to the model. */
  maxContextChars: number;
  /** Output token ceiling for the synthesis call. */
  maxOutputTokens: number;
}

export interface ResearchPackage {
  id: ResearchPackageId;
  name: string;
  /** One line, used on cards. */
  summary: string;
  /** Two or three sentences, used on the package page and confirmation screen. */
  description: string;
  /** What the buyer actually receives. Rendered as a list. */
  deliverables: readonly string[];
  tokenCost: number;
  modules: readonly ResearchModule[];
  limits: PackageLimits;
  /** Rough guidance shown before confirmation. Not a promise. */
  typicalDurationMinutes: readonly [number, number];
  enabled: boolean;
}

/**
 * Shared ceilings. A package may tighten these but never exceed them — see
 * assertLimitsAreSane below, which runs at module load.
 */
export const GLOBAL_RESEARCH_CEILINGS = {
  maxSearchQueries: 40,
  maxSources: 120,
  maxOwnSitePages: 25,
  maxPagesPerExternalSite: 4,
  maxTotalCrawlBytes: 24 * 1024 * 1024,
  maxCrawlMs: 180_000,
  maxContextChars: 220_000,
  maxOutputTokens: 16_000,
} as const;

const COMPETITOR_LIMITS: PackageLimits = {
  maxCompetitors: 5,
  maxLeads: 0,
  maxInfluencers: 0,
  maxSearchQueries: 14,
  maxSources: 45,
  maxOwnSitePages: 25,
  maxPagesPerExternalSite: 4,
  maxTotalCrawlBytes: 12 * 1024 * 1024,
  maxCrawlMs: 90_000,
  maxContextChars: 110_000,
  maxOutputTokens: 14_000,
};

const LEAD_LIMITS: PackageLimits = {
  maxCompetitors: 0,
  maxLeads: 25,
  maxInfluencers: 0,
  maxSearchQueries: 18,
  maxSources: 70,
  maxOwnSitePages: 25,
  maxPagesPerExternalSite: 2,
  maxTotalCrawlBytes: 14 * 1024 * 1024,
  maxCrawlMs: 110_000,
  maxContextChars: 130_000,
  maxOutputTokens: 16_000,
};

const INFLUENCER_LIMITS: PackageLimits = {
  maxCompetitors: 0,
  maxLeads: 0,
  maxInfluencers: 25,
  maxSearchQueries: 20,
  maxSources: 70,
  maxOwnSitePages: 25,
  // Creator profiles are read through public web results and the creator's own
  // pages. Platform pages themselves are not crawled — see lib/research/policy.ts.
  maxPagesPerExternalSite: 2,
  maxTotalCrawlBytes: 14 * 1024 * 1024,
  maxCrawlMs: 110_000,
  maxContextChars: 130_000,
  maxOutputTokens: 16_000,
};

const MARKET_PACK_LIMITS: PackageLimits = {
  maxCompetitors: 5,
  maxLeads: 25,
  maxInfluencers: 25,
  // Deliberately far below the sum of the three: the whole point of the pack is
  // that the shared stages — understanding the business, crawling its own site,
  // building the source registry — happen once.
  maxSearchQueries: 36,
  maxSources: 120,
  maxOwnSitePages: 25,
  maxPagesPerExternalSite: 3,
  maxTotalCrawlBytes: 24 * 1024 * 1024,
  maxCrawlMs: 180_000,
  maxContextChars: 220_000,
  maxOutputTokens: 16_000,
};

export const RESEARCH_PACKAGES: Record<ResearchPackageId, ResearchPackage> = {
  'competitor-intelligence': {
    id: 'competitor-intelligence',
    name: 'Competitor Intelligence',
    summary: 'Five ranked competitors, compared against you on the public record.',
    description:
      'We work out what you sell, find the companies competing for the same buyers in your market, read their public pages, and compare them with you across products, positioning, audience, messaging and trust signals. Every claim carries a link to where we found it.',
    deliverables: [
      'Market overview and your own company profile',
      'Five ranked competitors, labelled direct or indirect',
      'Product, pricing, positioning and audience comparison',
      'Strengths, weaknesses and review themes for each',
      'Opportunity gaps, risks and per-competitor battlecards',
      'Recommended positioning, offer and next actions',
      'CSV export of the full comparison table',
    ],
    tokenCost: 100,
    modules: ['competitors', 'strategy'],
    limits: COMPETITOR_LIMITS,
    typicalDurationMinutes: [3, 8],
    enabled: true,
  },

  'lead-finder': {
    id: 'lead-finder',
    name: 'Target Customer & Lead Finder',
    summary: 'Twenty-five real organisations that plausibly need what you sell.',
    description:
      'We build an ideal-customer profile from your offer, then find organisations matching it that have a genuine public web presence. Each lead is scored, evidenced, and paired with an outreach angle drawn from something we can actually point at.',
    deliverables: [
      'Your offer summarised, plus an ideal-customer profile',
      'Primary and secondary segments, buyer needs and objections',
      'Twenty-five ranked organisations with fit scores and confidence',
      'Evidence, likely pain points and what to pitch',
      'A personalised opening line, email and LinkedIn message per lead',
      'Public contact page links — never a guessed address',
      'CSV export of the full lead list',
    ],
    tokenCost: 150,
    modules: ['leads', 'strategy'],
    limits: LEAD_LIMITS,
    typicalDurationMinutes: [4, 10],
    enabled: true,
  },

  'influencer-outreach': {
    id: 'influencer-outreach',
    name: 'Influencer Outreach List',
    summary: 'Twenty-five creators ranked on audience fit, not follower count.',
    description:
      'We define the creator profile that suits your product and audience, find creators with real public presences, and rank them on how well their audience matches your buyer. Follower counts appear only where a reliable public source states them.',
    deliverables: [
      'Brand and campaign summary, plus the ideal creator profile',
      'Recommended platform strategy and creator-size mix',
      'Twenty-five ranked creators with brand-fit scores and confidence',
      'Audience-fit reasoning, content style and brand-safety notes',
      'A campaign concept, opening line and full outreach message each',
      'Suggested deliverables and a compensation approach',
      'CSV export of the full creator list',
    ],
    tokenCost: 180,
    modules: ['influencers', 'strategy'],
    limits: INFLUENCER_LIMITS,
    typicalDurationMinutes: [4, 12],
    enabled: true,
  },

  'market-pack': {
    id: 'market-pack',
    name: 'Complete Market Pack',
    summary: 'All three reports plus one combined strategy, from one research pass.',
    description:
      'Competitor Intelligence, the Lead Finder and the Influencer Outreach List, run as a single job so the shared work — understanding your business, crawling your site, building the source registry — happens once. Ends with one ninety-day plan rather than three separate ones.',
    deliverables: [
      'Executive market summary across all three areas',
      'Five competitors, twenty-five leads, twenty-five creators',
      'One consolidated source registry shared by every section',
      'Positioning recommendation and marketing opportunities',
      'Recommended acquisition channels',
      'A ninety-day action plan and a prioritised first ten actions',
      'Separate CSV exports for competitors, leads and creators',
    ],
    tokenCost: 350,
    modules: ['competitors', 'leads', 'influencers', 'strategy'],
    limits: MARKET_PACK_LIMITS,
    typicalDurationMinutes: [8, 20],
    enabled: true,
  },
};

export const PACKAGE_LIST: readonly ResearchPackage[] = RESEARCH_PACKAGE_IDS.map(
  (id) => RESEARCH_PACKAGES[id],
);

export function isResearchPackageId(value: unknown): value is ResearchPackageId {
  return (
    typeof value === 'string' &&
    (RESEARCH_PACKAGE_IDS as readonly string[]).includes(value)
  );
}

/**
 * The server's answer to "what does this cost".
 *
 * Throws rather than returning a default: a request naming an unknown package
 * is a request we should refuse, not one we should price at zero.
 */
export function tokenCostFor(id: ResearchPackageId): number {
  return getPackage(id).tokenCost;
}

export function getPackage(id: ResearchPackageId): ResearchPackage {
  const pkg = RESEARCH_PACKAGES[id];
  // The type says this cannot happen, but the id arrives from a request body.
  // A TypeError here would surface as a 500 with a stack; this surfaces as the
  // refusal it actually is.
  if (!pkg) throw new PlatformError('INVALID_INPUT', `Unknown research package: ${id}`);
  return pkg;
}

export function packageHasModule(id: ResearchPackageId, module: ResearchModule): boolean {
  return RESEARCH_PACKAGES[id].modules.includes(module);
}

/**
 * Load-time guard.
 *
 * A package whose limits exceed the global ceilings is a cost incident waiting
 * to happen, and the mistake is easy to make — the numbers are far apart in the
 * file from the ceiling they must respect. Failing at import turns it into a
 * failure nobody can deploy past.
 */
function assertLimitsAreSane(): void {
  for (const pkg of PACKAGE_LIST) {
    for (const [key, ceiling] of Object.entries(GLOBAL_RESEARCH_CEILINGS)) {
      const value = pkg.limits[key as keyof PackageLimits];
      if (value > ceiling) {
        throw new Error(
          `Package "${pkg.id}" sets ${key}=${value}, above the global ceiling of ${ceiling}`,
        );
      }
    }
    if (pkg.tokenCost <= 0 || !Number.isInteger(pkg.tokenCost)) {
      throw new Error(`Package "${pkg.id}" has a non-positive or fractional token cost`);
    }
  }
}

assertLimitsAreSane();
