import { z } from 'zod';

/**
 * The vocabulary every report shares.
 *
 * Three ideas do most of the work here, and they exist because a research
 * report's failure mode is not being wrong — it is being confidently wrong in a
 * way nobody can check.
 *
 *   Citations. Every factual field carries source references, validated against
 *   the job's registry. A claim whose sources do not exist is rejected rather
 *   than rendered.
 *
 *   Provenance. `measured`, `sourced`, `inferred` and `unavailable` are
 *   different things, and collapsing them is how "their pricing page lists
 *   £49/month" and "they probably charge around £50" end up looking identical
 *   in a report. The model must label which it is doing, and the renderer shows
 *   the label.
 *
 *   Unavailability as a value. `unavailable` is a first-class option
 *   everywhere a number might be tempting. The alternative to a real follower
 *   count is not an estimate; it is saying we could not find one.
 *
 * Every string is capped. Caps are not cosmetic: they bound worst-case output
 * cost, and they stop a runaway generation from producing a report nobody can
 * read.
 */

export const RESEARCH_SCHEMA_VERSION = 1;

/** How much weight a reader should put on a claim. */
export const confidenceSchema = z.enum(['high', 'medium', 'low']);
export type Confidence = z.infer<typeof confidenceSchema>;

/**
 * Where a value came from.
 *
 *   measured     read directly off a page we fetched
 *   sourced      stated by a named public source we did not fetch ourselves
 *   inferred     our reasoning from other evidence, not stated anywhere
 *   unavailable  we looked and could not establish it
 */
export const basisSchema = z.enum(['measured', 'sourced', 'inferred', 'unavailable']);
export type Basis = z.infer<typeof basisSchema>;

/**
 * A reference into the job's source registry: `S1`, `S2`, …
 *
 * The shape is checked here; whether the source exists is checked by the
 * cross-reference validator, which is the only thing that has the registry.
 */
export const sourceRefSchema = z
  .string()
  .regex(/^S\d{1,4}$/, 'Source references look like S1, S2, S3');

export type SourceRef = z.infer<typeof sourceRefSchema>;

/**
 * A factual claim with its evidence.
 *
 * `sources` may be empty only when `basis` is `inferred` or `unavailable` —
 * enforced by the cross-reference validator rather than by Zod, because it is a
 * relationship between two fields rather than a property of one.
 */
export const evidencedClaimSchema = z.object({
  /** The claim itself, in plain language. */
  statement: z.string().min(1).max(600),
  basis: basisSchema,
  confidence: confidenceSchema,
  sources: z.array(sourceRefSchema).max(8),
});
export type EvidencedClaim = z.infer<typeof evidencedClaimSchema>;

/**
 * A value that may simply not be knowable.
 *
 * Used wherever a report would otherwise be tempted to invent a number:
 * pricing, follower counts, company size. `basis: 'unavailable'` with a null
 * value is a complete, valid answer.
 */
export const optionalValueSchema = z.object({
  value: z.string().max(300).nullable(),
  basis: basisSchema,
  confidence: confidenceSchema,
  sources: z.array(sourceRefSchema).max(6),
  /** Why it could not be established, when it could not. */
  note: z.string().max(300).nullable(),
});
export type OptionalValue = z.infer<typeof optionalValueSchema>;

/** Something the report could not determine, and what would answer it. */
export const limitationSchema = z.object({
  area: z.string().min(1).max(120),
  detail: z.string().min(1).max(500),
  howToResolve: z.string().max(300).nullable(),
});
export type Limitation = z.infer<typeof limitationSchema>;

/**
 * Two sources that disagree.
 *
 * Recorded rather than silently resolved. Picking a winner and saying nothing
 * is how a report becomes more confident than its evidence.
 */
export const conflictSchema = z.object({
  topic: z.string().min(1).max(200),
  positions: z
    .array(
      z.object({
        claim: z.string().min(1).max(400),
        sources: z.array(sourceRefSchema).min(1).max(6),
      }),
    )
    .min(2)
    .max(4),
  note: z.string().max(400).nullable(),
});
export type SourceConflict = z.infer<typeof conflictSchema>;

/** A recommended action. Shared by every package's plan section. */
export const actionSchema = z.object({
  title: z.string().min(1).max(140),
  detail: z.string().min(1).max(600),
  effort: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high']),
  owner: z.enum(['founder', 'marketing', 'sales', 'product', 'agency']),
});
export type ResearchAction = z.infer<typeof actionSchema>;

/** A public contact route, only ever taken from a page that published it. */
export const contactRouteSchema = z.object({
  /** A contact or about page. Preferred over an address. */
  contactPageUrl: z.url().max(500).nullable(),
  /**
   * A general business address, only where a company published one.
   *
   * Never constructed from a person's name and a domain. A guessed address is
   * useless and gets senders blocked, and this field existing is not permission
   * to fill it.
   */
  publishedEmail: z.email().max(200).nullable(),
  sources: z.array(sourceRefSchema).max(4),
});
export type ContactRoute = z.infer<typeof contactRouteSchema>;

/**
 * The header every report carries.
 *
 * Scores are deliberately absent: nothing here is an overall number the model
 * chose. Where a report has scores they are per-item and defined by a rubric.
 */
export const reportHeaderSchema = z.object({
  /** One or two sentences a reader can act on without scrolling. */
  headline: z.string().min(1).max(240),
  /** Three to six sentences. The whole report in a paragraph. */
  executiveSummary: z.string().min(1).max(2000),
});

/** The trailer every report carries. */
export const reportFooterSchema = z.object({
  limitations: z.array(limitationSchema).min(1).max(10),
  conflicts: z.array(conflictSchema).max(6),
});

/**
 * What we understood about the submitted business.
 *
 * Every package starts here, and in the Complete Market Pack it is computed
 * once and shared rather than three times over.
 */
export const businessProfileSchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().max(500),
  whatTheySell: z.string().min(1).max(900),
  audience: z.string().min(1).max(600),
  positioning: z.string().min(1).max(600),
  /** Signals of size, only where a page said so. */
  scaleSignals: z.array(evidencedClaimSchema).max(6),
  sources: z.array(sourceRefSchema).min(1).max(12),
});
export type BusinessProfile = z.infer<typeof businessProfileSchema>;

/** Model and cost metadata, stored with every report. */
export const reportMetaSchema = z.object({
  model: z.string(),
  promptVersion: z.string(),
  researchProvider: z.string(),
  searchQueries: z.number().int().min(0),
  pagesRead: z.number().int().min(0),
  sourceCount: z.number().int().min(0),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  repairAttempts: z.number().int().min(0),
  durationMs: z.number().int().min(0),
});
export type ReportMeta = z.infer<typeof reportMetaSchema>;

/** One entry in the rendered source list. */
export const storedSourceSchema = z.object({
  ref: sourceRefSchema,
  position: z.number().int().min(1),
  url: z.string().max(2000),
  title: z.string().max(300).nullable(),
  publisherDomain: z.string().max(255).nullable(),
  retrievedAt: z.string(),
  fetched: z.boolean(),
});
export type StoredSource = z.infer<typeof storedSourceSchema>;
