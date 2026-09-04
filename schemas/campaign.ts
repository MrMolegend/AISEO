import { z } from 'zod';

/**
 * Campaigns: the deliberate act of spending research.
 *
 * A campaign pairs an ideal customer profile with a territory selection and
 * a product objective, then runs a bounded discovery pipeline. Its caps
 * default from the ICP but may be narrowed per campaign; they may never
 * exceed the ICP's own ceilings by more than the schema bounds allow —
 * the cost preview and the daily cap are enforced again server-side at
 * start time.
 */

export const CAMPAIGN_STATUSES = [
  'draft',
  'running',
  'completed',
  'partial',
  'failed',
  'cancelled',
  'archived',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  running: 'Running',
  completed: 'Completed',
  partial: 'Completed with limits',
  failed: 'Failed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

/** The discovery pipeline's observable stages, in order. */
export const RUN_STAGES = [
  'queued',
  'planning',
  'discovering_accounts',
  'normalising_accounts',
  'enriching_accounts',
  'discovering_contacts',
  'resolving_relationships',
  'quality_review',
  'done',
] as const;

export type RunStage = (typeof RUN_STAGES)[number];

export const RUN_STAGE_LABEL: Record<RunStage, string> = {
  queued: 'Queued',
  planning: 'Planning the searches',
  discovering_accounts: 'Discovering candidate accounts',
  normalising_accounts: 'Normalising and deduplicating',
  enriching_accounts: 'Gathering fit evidence',
  discovering_contacts: 'Looking for decision-makers',
  resolving_relationships: 'Checking for warm paths',
  quality_review: 'Applying the quality gate',
  done: 'Finished',
};

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1, { error: 'Give the campaign a name.' }).max(160),
  icpId: z.uuid({ error: 'Choose an ideal customer profile.' }),
  objective: z
    .string()
    .trim()
    .max(2000, { error: 'Keep the objective under 2000 characters.' })
    .default(''),
  territoryKeys: z
    .array(z.string().trim().min(1).max(40))
    .min(1, { error: 'Choose at least one territory.' })
    .max(20),
  language: z.enum(['en', 'ar', 'both']).default('en'),
  maxAccounts: z.coerce.number().int().min(1).max(200),
  maxContactsPerAccount: z.coerce.number().int().min(1).max(10),
  budgetUnits: z.coerce.number().int().min(1).max(2000),
  ownerId: z.uuid().nullable().default(null),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;

export const LEAD_STATUSES = [
  'candidate',
  'research_needed',
  'qualified',
  'rejected',
  'merged',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  candidate: 'Candidate',
  research_needed: 'Research needed',
  qualified: 'Qualified',
  rejected: 'Rejected',
  merged: 'Merged',
};
