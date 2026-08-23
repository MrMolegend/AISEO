import { z } from 'zod';
import { type RESEARCH_PACKAGE_IDS } from '@/config/packages';

/**
 * What each package asks the user for.
 *
 * These schemas run on the server before a single token moves, which is why
 * INVALID_INPUT is a non-refunding error: there is nothing to refund yet.
 *
 * Two rules run through all of them:
 *
 *   Free text is capped and trimmed. Every one of these fields ends up inside a
 *   prompt, and an unbounded field is both a cost problem and the obvious place
 *   to attempt an injection. The caps here are the first bound; the nonce
 *   wrapping in the prompt builder is the second, and output validation is the
 *   third.
 *
 *   The package id is never trusted for pricing. It selects a schema and a
 *   catalogue entry; the cost comes from config/packages.ts on the server.
 */

/** Trims, collapses internal whitespace, and treats an empty string as absent. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v.replace(/\s+/g, ' ')))
    .nullable()
    .default(null);

const requiredText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .transform((v) => v.replace(/\s+/g, ' '));

/**
 * A website address as typed by a person.
 *
 * Deliberately lenient about the scheme — people type "example.com" — and
 * strict about everything else. The real validation is
 * validateAndNormalizeUrl, which the pipeline runs before fetching; this is
 * only enough to reject something that is obviously not a website before we
 * bother.
 */
const websiteInput = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .refine(
    (value) =>
      /^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(value.replace(/^https?:\/\//i, '')),
    {
      message: 'Enter a website address, for example example.com',
    },
  );

/** ISO 3166-1 alpha-2, or a free-text market description. */
const marketInput = requiredText(2, 120);

/* ────────────────────────── Competitor Intelligence ────────────────────────── */

export const competitorInputSchema = z.object({
  packageId: z.literal('competitor-intelligence'),
  companyName: requiredText(2, 200),
  website: websiteInput,
  market: marketInput,
  industry: optionalText(160),
  customerDescription: optionalText(600),
  /** Names or URLs the user already suspects. Used as a starting point only. */
  knownCompetitors: z.array(z.string().trim().max(200)).max(10).default([]),
  specificQuestions: optionalText(800),
});
export type CompetitorInput = z.infer<typeof competitorInputSchema>;

/* ─────────────────────── Target Customer & Lead Finder ─────────────────────── */

export const leadFinderInputSchema = z
  .object({
    packageId: z.literal('lead-finder'),
    businessName: requiredText(2, 200),
    website: websiteInput,
    offerDescription: requiredText(20, 1200),
    market: marketInput,
    targetIndustry: optionalText(200),
    /**
     * Free text rather than an enum: "under 50 staff", "£1–10m turnover" and
     * "independent, owner-run" are all things people actually mean, and an
     * enum would force them into the nearest wrong box.
     */
    idealCompanySize: optionalText(200),
    audienceType: z.enum(['b2b', 'b2c']).default('b2b'),
    minCompanySize: z.coerce
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .nullable()
      .default(null),
    maxCompanySize: z.coerce
      .number()
      .int()
      .min(0)
      .max(1_000_000)
      .nullable()
      .default(null),
    exclusions: optionalText(600),
    desiredLeadCount: z.coerce.number().int().min(1).max(25).default(25),
  })
  .refine(
    (v) =>
      v.minCompanySize === null ||
      v.maxCompanySize === null ||
      v.minCompanySize <= v.maxCompanySize,
    {
      message: 'The minimum company size cannot exceed the maximum',
      path: ['minCompanySize'],
    },
  );
export type LeadFinderInput = z.infer<typeof leadFinderInputSchema>;

/* ────────────────────────── Influencer Outreach List ───────────────────────── */

export const influencerInputSchema = z
  .object({
    packageId: z.literal('influencer-outreach'),
    brandName: requiredText(2, 200),
    website: websiteInput,
    productDescription: requiredText(20, 1200),
    campaignGoal: requiredText(10, 600),
    targetCustomer: requiredText(10, 800),
    market: marketInput,
    platform: z
      .enum(['instagram', 'tiktok', 'youtube', 'linkedin', 'mixed'])
      .default('mixed'),
    niche: optionalText(200),
    creatorSize: z.enum(['nano', 'micro', 'mid', 'macro', 'any']).default('any'),
    minFollowers: z.coerce
      .number()
      .int()
      .min(0)
      .max(500_000_000)
      .nullable()
      .default(null),
    maxFollowers: z.coerce
      .number()
      .int()
      .min(0)
      .max(500_000_000)
      .nullable()
      .default(null),
    exclusions: optionalText(600),
  })
  .refine(
    (v) =>
      v.minFollowers === null ||
      v.maxFollowers === null ||
      v.minFollowers <= v.maxFollowers,
    {
      message: 'The minimum follower count cannot exceed the maximum',
      path: ['minFollowers'],
    },
  );
export type InfluencerInput = z.infer<typeof influencerInputSchema>;

/* ──────────────────────────── Complete Market Pack ─────────────────────────── */

/**
 * The pack asks once for what the three separate packages would ask three
 * times. Anything only one of them needs is optional here — a user buying the
 * combined report should not have to fill in a longer form than the sum of its
 * parts.
 */
export const marketPackInputSchema = z.object({
  packageId: z.literal('market-pack'),
  businessName: requiredText(2, 200),
  website: websiteInput,
  offerDescription: requiredText(20, 1200),
  market: marketInput,
  industry: optionalText(200),
  targetCustomer: requiredText(10, 800),
  audienceType: z.enum(['b2b', 'b2c']).default('b2b'),
  idealCompanySize: optionalText(200),
  knownCompetitors: z.array(z.string().trim().max(200)).max(10).default([]),
  platform: z
    .enum(['instagram', 'tiktok', 'youtube', 'linkedin', 'mixed'])
    .default('mixed'),
  campaignGoal: optionalText(600),
  exclusions: optionalText(600),
  specificQuestions: optionalText(800),
});
export type MarketPackInput = z.infer<typeof marketPackInputSchema>;

/* ─────────────────────────────── Dispatch ──────────────────────────────────── */

export const researchInputSchema = z.discriminatedUnion('packageId', [
  competitorInputSchema,
  leadFinderInputSchema,
  influencerInputSchema,
  marketPackInputSchema,
]);

export type ResearchInput = z.infer<typeof researchInputSchema>;

export const INPUT_SCHEMAS = {
  'competitor-intelligence': competitorInputSchema,
  'lead-finder': leadFinderInputSchema,
  'influencer-outreach': influencerInputSchema,
  'market-pack': marketPackInputSchema,
} as const;

/** Compile-time proof that every package in the catalogue has an input schema. */
const _everyPackageIsCovered: Record<(typeof RESEARCH_PACKAGE_IDS)[number], unknown> =
  INPUT_SCHEMAS;
void _everyPackageIsCovered;

/**
 * The subject of a job, extracted from whichever input shape it is.
 *
 * Used for the dashboard listing, the cache key and the report header, so it
 * lives here beside the schemas rather than being re-derived at each call site.
 */
export function subjectOf(input: ResearchInput): { name: string; website: string } {
  switch (input.packageId) {
    case 'competitor-intelligence':
      return { name: input.companyName, website: input.website };
    case 'lead-finder':
      return { name: input.businessName, website: input.website };
    case 'influencer-outreach':
      return { name: input.brandName, website: input.website };
    case 'market-pack':
      return { name: input.businessName, website: input.website };
  }
}
