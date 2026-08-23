import { z } from 'zod';
import {
  actionSchema,
  businessProfileSchema,
  confidenceSchema,
  contactRouteSchema,
  evidencedClaimSchema,
  optionalValueSchema,
  reportFooterSchema,
  reportHeaderSchema,
  sourceRefSchema,
} from './shared';

/**
 * One output schema per package.
 *
 * Deliberately four schemas rather than one large one with optional sections.
 * The previous incarnation of this codebase hit Anthropic's compiled-grammar
 * size limit by handing over a single enormous schema, and the fix — a
 * non-strict tool plus real server-side validation — works better when each
 * schema describes only what that package actually produces. A schema full of
 * optional sections also teaches the model that skipping them is acceptable.
 *
 * Every score here is per-item and rubric-defined. There is no model-generated
 * overall score anywhere: an overall number the model chose is a number that
 * cannot be reproduced or argued with.
 */

/* ────────────────────────── Competitor Intelligence ────────────────────────── */

export const competitorSchema = z.object({
  /** Stable within the report, for anchors and CSV rows. */
  id: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Use a kebab-case identifier'),
  rank: z.number().int().min(1).max(10),
  name: z.string().min(1).max(200),
  website: z.string().max(500),
  /**
   * Direct competitors sell the same thing to the same buyer. Indirect ones
   * solve the same problem differently, and are the ones a company usually
   * forgets to look at.
   */
  type: z.enum(['direct', 'indirect']),
  whyRanked: z.string().min(1).max(600),
  confidence: confidenceSchema,

  offering: z.string().min(1).max(900),
  audience: z.string().min(1).max(600),
  positioning: z.string().min(1).max(600),
  marketingMessage: z.string().min(1).max(600),

  /**
   * Pricing where the company publishes it.
   *
   * The single most tempting field to invent in a competitor report, and the
   * one most likely to be quoted back in a meeting. `unavailable` is the right
   * answer far more often than a number is.
   */
  pricing: optionalValueSchema,

  strengths: z.array(evidencedClaimSchema).min(1).max(6),
  weaknesses: z.array(evidencedClaimSchema).min(1).max(6),
  trustSignals: z.array(evidencedClaimSchema).max(6),
  /** Themes across public reviews, never invented ratings. */
  reviewThemes: z.array(evidencedClaimSchema).max(6),

  /** What to say when you meet them in a deal. */
  battlecard: z.object({
    theirPitch: z.string().min(1).max(500),
    whereTheyWin: z.string().min(1).max(500),
    whereYouWin: z.string().min(1).max(500),
    objectionToExpect: z.string().min(1).max(400),
    yourResponse: z.string().min(1).max(500),
  }),

  sources: z.array(sourceRefSchema).min(1).max(12),
});
export type Competitor = z.infer<typeof competitorSchema>;

export const competitorReportSchema = reportHeaderSchema
  .extend({
    business: businessProfileSchema,
    marketOverview: z.string().min(1).max(1600),
    competitors: z.array(competitorSchema).min(1).max(5),
    opportunityGaps: z.array(evidencedClaimSchema).min(1).max(8),
    risks: z.array(evidencedClaimSchema).min(1).max(6),
    recommendedPositioning: z.string().min(1).max(900),
    recommendedOffer: z.string().min(1).max(900),
    nextActions: z.array(actionSchema).min(3).max(10),
  })
  .extend(reportFooterSchema.shape);
export type CompetitorReport = z.infer<typeof competitorReportSchema>;

/* ─────────────────────── Target Customer & Lead Finder ─────────────────────── */

export const companyLeadSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  rank: z.number().int().min(1).max(50),
  name: z.string().min(1).max(200),
  website: z.string().max(500),
  location: z.string().max(200),
  industry: z.string().max(160),
  /** How the company describes itself publicly. Not our characterisation. */
  publicDescription: z.string().min(1).max(800),

  /**
   * Rubric-scored fit, 0–100.
   *
   * Per-lead and defined by the prompt's bands, so two leads with the same
   * evidence get the same score. Not an overall report score.
   */
  fitScore: z.number().int().min(0).max(100),
  confidence: confidenceSchema,
  fitEvidence: z.array(evidencedClaimSchema).min(1).max(6),

  /**
   * Wording matters here. Public evidence rarely shows that a company *has* a
   * problem; it shows something consistent with one. The prompt requires
   * "possible need" phrasing where the evidence is indirect, and the validator
   * checks for asserted-problem language.
   */
  likelyNeeds: z.array(evidencedClaimSchema).min(1).max(5),
  recommendedPitch: z.string().min(1).max(600),

  openingLine: z.string().min(1).max(400),
  emailDraft: z.string().min(1).max(1800),
  linkedinMessage: z.string().min(1).max(700),
  /** Only where a business publishes a messaging number. Often null. */
  shortMessage: z.string().max(500).nullable(),

  contact: contactRouteSchema,
  sources: z.array(sourceRefSchema).min(1).max(10),
});
export type CompanyLead = z.infer<typeof companyLeadSchema>;

export const customerSegmentSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(700),
  whyTheyBuy: z.string().min(1).max(600),
  whereToFindThem: z.string().min(1).max(500),
});

export const leadReportSchema = reportHeaderSchema
  .extend({
    business: businessProfileSchema,
    idealCustomerProfile: z.object({
      description: z.string().min(1).max(1200),
      companySize: z.string().max(200),
      geography: z.string().max(200),
      buyingTrigger: z.string().max(500),
      disqualifiers: z.array(z.string().max(240)).max(6),
    }),
    primarySegments: z.array(customerSegmentSchema).min(1).max(4),
    secondarySegments: z.array(customerSegmentSchema).max(4),
    buyerNeeds: z.array(z.string().min(1).max(400)).min(2).max(8),
    commonObjections: z
      .array(
        z.object({
          objection: z.string().min(1).max(300),
          response: z.string().min(1).max(500),
        }),
      )
      .min(2)
      .max(6),
    recommendedPositioning: z.string().min(1).max(900),
    leads: z.array(companyLeadSchema).min(1).max(25),
    nextActions: z.array(actionSchema).min(3).max(10),
  })
  .extend(reportFooterSchema.shape);
export type LeadReport = z.infer<typeof leadReportSchema>;

/* ────────────────────────── Influencer Outreach List ───────────────────────── */

export const platformSchema = z.enum([
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'other',
]);

export const creatorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  rank: z.number().int().min(1).max(50),
  name: z.string().min(1).max(200),
  platform: platformSchema,
  /** Public profile links. What we could actually find, not what should exist. */
  profileUrls: z.array(z.string().max(500)).min(1).max(4),
  niche: z.string().min(1).max(200),

  /** Only where a public source stated it. Very often unavailable. */
  location: optionalValueSchema,
  /**
   * Audience size, only where a reliable public source stated it.
   *
   * We do not fetch platform pages — their terms forbid it — so this is
   * `unavailable` unless a source we were allowed to read published a figure.
   * Engagement rate and audience demographics are not fields at all, because
   * there is no honest way for us to obtain them.
   */
  audienceSize: optionalValueSchema,

  audienceFit: z.string().min(1).max(700),
  contentStyle: z.string().min(1).max(600),
  /** Rubric-scored, 0–100, per creator. */
  brandFitScore: z.number().int().min(0).max(100),
  confidence: confidenceSchema,
  evidence: z.array(evidencedClaimSchema).min(1).max(6),

  campaignConcept: z.string().min(1).max(700),
  openingLine: z.string().min(1).max(400),
  outreachMessage: z.string().min(1).max(1600),
  suggestedDeliverable: z.string().min(1).max(400),
  /**
   * A compensation *approach*, not a rate.
   *
   * We have no reliable public data on what any creator charges, so a specific
   * figure would be invented. The prompt asks for a structure — gifted, flat
   * fee band, affiliate, hybrid — and the reasoning behind it.
   */
  compensationApproach: z.string().min(1).max(600),

  brandSafetyNotes: z.string().max(700).nullable(),
  contact: contactRouteSchema,
  sources: z.array(sourceRefSchema).min(1).max(10),
});
export type Creator = z.infer<typeof creatorSchema>;

export const influencerReportSchema = reportHeaderSchema
  .extend({
    business: businessProfileSchema,
    campaignSummary: z.string().min(1).max(1200),
    targetAudience: z.string().min(1).max(900),
    idealCreatorProfile: z.string().min(1).max(1000),
    platformStrategy: z.string().min(1).max(900),
    creatorMix: z.string().min(1).max(700),
    creators: z.array(creatorSchema).min(1).max(25),
    nextActions: z.array(actionSchema).min(3).max(10),
  })
  .extend(reportFooterSchema.shape);
export type InfluencerReport = z.infer<typeof influencerReportSchema>;

/* ──────────────────────────── Complete Market Pack ─────────────────────────── */

/**
 * The combined pack.
 *
 * Composed from the same section schemas rather than redefined, so a change to
 * the competitor shape cannot leave the pack describing a different one. The
 * shared business profile appears once at the top rather than three times.
 */
export const marketPackReportSchema = reportHeaderSchema
  .extend({
    business: businessProfileSchema,
    marketOverview: z.string().min(1).max(1600),

    competitors: z.array(competitorSchema).min(1).max(5),
    idealCustomerProfile: leadReportSchema.shape.idealCustomerProfile,
    primarySegments: z.array(customerSegmentSchema).min(1).max(4),
    leads: z.array(companyLeadSchema).min(1).max(25),
    creators: z.array(creatorSchema).min(1).max(25),

    recommendedPositioning: z.string().min(1).max(1000),
    marketingOpportunities: z.array(evidencedClaimSchema).min(2).max(8),
    acquisitionChannels: z
      .array(
        z.object({
          channel: z.string().min(1).max(160),
          rationale: z.string().min(1).max(600),
          effort: z.enum(['low', 'medium', 'high']),
          confidence: confidenceSchema,
        }),
      )
      .min(2)
      .max(6),

    ninetyDayPlan: z
      .array(
        z.object({
          phase: z.enum(['days-1-30', 'days-31-60', 'days-61-90']),
          focus: z.string().min(1).max(400),
          actions: z.array(actionSchema).min(1).max(6),
        }),
      )
      .length(3),
    firstTenActions: z.array(actionSchema).min(5).max(10),
    risks: z.array(evidencedClaimSchema).min(1).max(6),
  })
  .extend(reportFooterSchema.shape);
export type MarketPackReport = z.infer<typeof marketPackReportSchema>;

/* ─────────────────────────────── Dispatch ──────────────────────────────────── */

export const REPORT_SCHEMAS = {
  'competitor-intelligence': competitorReportSchema,
  'lead-finder': leadReportSchema,
  'influencer-outreach': influencerReportSchema,
  'market-pack': marketPackReportSchema,
} as const;

export type ReportSchemaFor<K extends keyof typeof REPORT_SCHEMAS> = z.infer<
  (typeof REPORT_SCHEMAS)[K]
>;

export type AnyResearchReport =
  CompetitorReport | LeadReport | InfluencerReport | MarketPackReport;
