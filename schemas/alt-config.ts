import { z } from 'zod';

/**
 * The keyed commercial configuration, and the schema for each key.
 *
 * One row per key in alt_config; the value is jsonb validated HERE on every
 * write and every read, so the database can never hold a shape the
 * application cannot re-read. Facts that can drift (proof points above all)
 * carry their source and the date they were recorded — outreach later
 * refuses to ground a claim in an unsourced proof point.
 */

export const FACT_SOURCES = [
  'alt_admin',
  'build_specification',
  'official_website',
  'official_linkedin',
] as const;

export type FactSource = (typeof FACT_SOURCES)[number];

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Use an ISO date, like 2026-09-03.' });

export const proofPointSchema = z.object({
  text: z.string().trim().min(1).max(300),
  source: z.enum(FACT_SOURCES),
  recordedOn: isoDate,
});

export const proofPointsSchema = z.array(proofPointSchema).max(30);

export const prohibitedClaimsSchema = z
  .array(
    z.object({
      text: z.string().trim().min(1).max(300),
      reason: z.string().trim().max(300).default(''),
    }),
  )
  .max(50);

export const outreachRulesSchema = z.object({
  tone: z.string().trim().max(600).default(''),
  signature: z.string().trim().max(600).default(''),
  disclaimer: z.string().trim().max(600).default(''),
  languages: z
    .array(z.enum(['en', 'ar']))
    .min(1)
    .default(['en']),
});

/**
 * The scoring dimensions, fixed vocabulary. Weights are integers 0–100;
 * the arithmetic normalises against their sum, so administrators think in
 * relative importance rather than fractions that must total one.
 */
export const SCORE_DIMENSIONS = [
  'account_fit',
  'commercial_opportunity',
  'product_match',
  'scale_potential',
  'territory_relevance',
  'buyer_accessibility',
  'relationship_strength',
  'timing_signals',
  'evidence_confidence',
  'data_freshness',
] as const;

export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export const SCORE_DIMENSION_LABEL: Record<ScoreDimension, string> = {
  account_fit: 'Account fit',
  commercial_opportunity: 'Commercial opportunity',
  product_match: 'Product and brand match',
  scale_potential: 'Scale potential',
  territory_relevance: 'Territory relevance',
  buyer_accessibility: 'Buyer accessibility',
  relationship_strength: 'Relationship strength',
  timing_signals: 'Timing signals',
  evidence_confidence: 'Evidence confidence',
  data_freshness: 'Data freshness',
};

export const scoringWeightsSchema = z
  .object(
    Object.fromEntries(
      SCORE_DIMENSIONS.map((dimension) => [dimension, z.number().int().min(0).max(100)]),
    ) as Record<ScoreDimension, z.ZodNumber>,
  )
  .refine((weights) => Object.values(weights).some((weight) => weight > 0), {
    error: 'At least one dimension must carry weight.',
  });

export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  account_fit: 20,
  commercial_opportunity: 15,
  product_match: 15,
  scale_potential: 10,
  territory_relevance: 10,
  buyer_accessibility: 8,
  relationship_strength: 8,
  timing_signals: 4,
  evidence_confidence: 6,
  data_freshness: 4,
};

export const budgetCapsSchema = z.object({
  /** Research units one campaign may consume across its lifetime. */
  perCampaignUnits: z.number().int().min(1).max(2000),
  /** Research units the whole workspace may consume per calendar day. */
  perDayUnits: z.number().int().min(1).max(5000),
});

export const DEFAULT_BUDGET_CAPS = {
  perCampaignUnits: 100,
  perDayUnits: 400,
} as const;

/** Every key the config store accepts, with its value schema. */
export const CONFIG_SCHEMAS = {
  proof_points: proofPointsSchema,
  prohibited_claims: prohibitedClaimsSchema,
  outreach_rules: outreachRulesSchema,
  scoring_weights: scoringWeightsSchema,
  budget_caps: budgetCapsSchema,
} as const;

export type ConfigKey = keyof typeof CONFIG_SCHEMAS;

export const CONFIG_KEYS = Object.keys(CONFIG_SCHEMAS) as ConfigKey[];

export const brandInputSchema = z.object({
  name: z.string().trim().min(1, { error: 'A brand name is required.' }).max(120),
  categories: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  positioning: z
    .enum(['premium', 'mid-market', 'value', 'mixed'])
    .nullable()
    .default(null),
  exclusivityNotes: z.string().trim().max(2000).default(''),
  source: z.enum(FACT_SOURCES).default('alt_admin'),
  recordedOn: isoDate.optional(),
  active: z.boolean().default(true),
});

export type BrandInput = z.infer<typeof brandInputSchema>;
