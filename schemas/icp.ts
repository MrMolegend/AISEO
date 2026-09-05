import { z } from 'zod';

/**
 * Ideal customer profiles.
 *
 * The queryable spine (name, territories, segments, evidence bar, caps) is
 * columns; everything else lives in a bounded `criteria` object validated
 * here on every write and re-validated on read. A criterion left empty
 * means "no constraint", never "unknown but assumed".
 */

const chip = z.string().trim().min(1).max(120);

export const EVIDENCE_LEVELS = ['minimal', 'standard', 'strict'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_LEVEL_LABEL: Record<EvidenceLevel, string> = {
  minimal: 'Minimal — one credible identifying source',
  standard: 'Standard — identity plus independent fit evidence',
  strict: 'Strict — multiple independent sources for identity and fit',
};

export const icpCriteriaSchema = z.object({
  independentOrChain: z.enum(['independent', 'chain', 'either']).default('either'),
  estimatedLocations: z.enum(['1', '2-5', '6-20', '20+', 'unknown']).default('unknown'),
  petCategories: z.array(chip).max(15).default([]),
  currentBrands: z.array(chip).max(30).default([]),
  positioning: z.enum(['premium', 'mid-market', 'value', 'mixed', 'any']).default('any'),
  onlinePresence: z.enum(['ecommerce', 'physical', 'both', 'any']).default('any'),
  serviceMix: z.array(chip).max(15).default([]),
  procurementNotes: z.string().trim().max(1000).default(''),
  desiredCategories: z.array(chip).max(20).default([]),
  exclusions: z.array(chip).max(30).default([]),
  targetRoles: z.array(chip).max(15).default([]),
  language: z.enum(['en', 'ar', 'both']).default('en'),
});

export type IcpCriteria = z.infer<typeof icpCriteriaSchema>;

export const icpInputSchema = z.object({
  name: z.string().trim().min(1, { error: 'Give the profile a name.' }).max(160),
  territoryKeys: z
    .array(z.string().trim().min(1).max(40))
    .min(1, { error: 'Choose at least one territory.' })
    .max(20),
  segmentKeys: z
    .array(z.string().trim().min(1).max(60))
    .min(1, { error: 'Choose at least one customer segment.' })
    .max(10),
  minEvidenceLevel: z.enum(EVIDENCE_LEVELS).default('standard'),
  maxAccounts: z.coerce.number().int().min(1).max(200).default(25),
  maxContactsPerAccount: z.coerce.number().int().min(1).max(10).default(3),
  researchBudgetUnits: z.coerce.number().int().min(1).max(2000).default(50),
  criteria: icpCriteriaSchema.default(() => icpCriteriaSchema.parse({})),
});

export type IcpInput = z.infer<typeof icpInputSchema>;
