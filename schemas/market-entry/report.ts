import { z } from 'zod';
import { sourceRefSchema } from '@/schemas/research/shared';
import { EVIDENCE_GRADES, VERDICTS } from '@/config/design';
import {
  marketClaimSchema,
  marketValueSchema,
  sourceCategorySchema,
  retrievalModeSchema,
  geographicRelevanceSchema,
} from './evidence';

/**
 * The Market Entry Intelligence Report.
 *
 * Split deliberately into two schemas that are never confused:
 *
 *   `modelReportSchema` is what the model is asked to produce. It contains
 *   findings and reasoning, and nothing that can be computed.
 *
 *   `marketEntryReportSchema` is what is stored and rendered. It is the model's
 *   output plus the parts this application works out for itself — the verdict,
 *   the readiness score, the margin scenarios, the evidence grades and the
 *   coverage figures.
 *
 * The separation is the whole design. A readiness score written by a language
 * model is a number that cannot be reproduced, cannot be argued with, and moves
 * if you ask twice. A readiness score computed from validated fields can be
 * explained to the customer, unit-tested against a table, and defended.
 */

export const MARKET_ENTRY_SCHEMA_VERSION = 2;

const confidence = z.enum(['high', 'medium', 'low']);
const shortText = (max: number) => z.string().min(1).max(max);

/* ───────────────────────── 2. Executive verdict ──────────────────────────── */

export const executiveSchema = z.object({
  /** Three to six sentences. The whole report in a paragraph. */
  summary: shortText(1800),
  /** Whether the market looks attractive, and why — as an evidenced claim. */
  attractiveness: marketClaimSchema,
  strongestOpportunity: marketClaimSchema,
  largestObstacle: marketClaimSchema,
  /**
   * What to decide next, not what to do next.
   *
   * A market-entry report that ends in "build a website" has answered the wrong
   * question. The customer came to decide whether to commit money to a market;
   * this field names the next decision on that path.
   */
  recommendedNextDecision: shortText(600),
});

/* ───────────────────────── 3. Commercial context ─────────────────────────── */

export const commercialContextSchema = z.object({
  offerSummary: shortText(900),
  currentSituation: shortText(700),
  routePreferenceNote: shortText(600),
  /**
   * Assumptions the report is standing on.
   *
   * Rendered above the analysis rather than buried at the end, because an
   * assumption a reader disagrees with changes how they should read everything
   * below it.
   */
  assumptions: z.array(shortText(400)).max(8),
});

/* ─────────────────────────── 4. Market signals ───────────────────────────── */

/**
 * A numeric series, for the one chart type this report may draw.
 *
 * Every point carries its own sources, because a five-year series assembled
 * from five different publishers is a different object from one taken from a
 * single statistical release, and the reader is entitled to know which they are
 * looking at. `lib/market-entry/charts.ts` refuses to render a series whose
 * points are not all numeric and sourced — a chart is the most authoritative
 * thing on a page and must not be the least evidenced.
 */
export const numericSeriesSchema = z.object({
  label: shortText(120),
  unit: shortText(40),
  points: z
    .array(
      z.object({
        period: shortText(40),
        value: z.number().finite(),
        sources: z.array(sourceRefSchema).min(1).max(4),
      }),
    )
    .min(3)
    .max(12),
  note: z.string().max(300).nullable(),
});

export const marketSignalsSchema = z.object({
  demand: z.array(marketClaimSchema).max(8),
  growth: z.array(marketClaimSchema).max(6),
  customerBehaviour: z.array(marketClaimSchema).max(6),
  trends: z.array(marketClaimSchema).max(6),
  /** Market size, where an authority published one. Frequently unavailable. */
  size: marketValueSchema,
  /** How much of the evidence above is actually about the target market. */
  geographicNote: shortText(500),
  series: z.array(numericSeriesSchema).max(2),
});

/* ────────────────────── 5. Competitive landscape ─────────────────────────── */

export const competitorSchema = z.object({
  /** Stable within the report, for anchors and export rows. */
  id: z.string().regex(/^[a-z0-9-]{3,60}$/, 'Use a kebab-case identifier'),
  rank: z.number().int().min(1).max(12),
  name: shortText(200),
  kind: z.enum(['direct', 'substitute', 'adjacent']),
  whyRelevant: shortText(600),
  productOverlap: marketClaimSchema,
  customerOverlap: marketClaimSchema,
  marketPresence: marketClaimSchema,
  positioning: shortText(600),
  /** The single most tempting field to invent. `unavailable` is often right. */
  pricing: marketValueSchema,
  strengths: z.array(marketClaimSchema).min(1).max(5),
  gaps: z.array(marketClaimSchema).max(5),
  confidence,
  /** Named explicitly so the renderer can show absence rather than hide it. */
  unknowns: z.array(shortText(200)).max(6),
});

export const competitiveSchema = z.object({
  entries: z.array(competitorSchema).max(10),
  /** Why the list is the length it is — including when it is short. */
  coverageNote: shortText(600),
});

/* ─────────────────── 6. Customer and buyer landscape ─────────────────────── */

export const buyerGroupSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  name: shortText(160),
  priority: z.enum(['primary', 'secondary', 'exploratory']),
  description: shortText(700),
  motivations: z.array(marketClaimSchema).max(5),
  purchaseCriteria: z.array(marketClaimSchema).max(5),
  objections: z.array(marketClaimSchema).max(5),
  /**
   * Channels, never contacts.
   *
   * This report names categories of buyer and the routes that reach them. It
   * does not name individuals and does not carry contact details — those are
   * neither researchable at this quality bar nor ours to publish.
   */
  channels: z.array(shortText(200)).max(6),
  confidence,
});

export const customersSchema = z.object({
  groups: z.array(buyerGroupSchema).max(6),
  uncertaintyNote: shortText(600),
});

/* ─────────────────────── 7. Route to market ──────────────────────────────── */

export const ROUTE_OPTION_IDS = [
  'direct-wholesale',
  'local-distributor',
  'retail-partnership',
  'ecommerce',
  'agent',
  'direct-corporate',
] as const;

export const routeOptionSchema = z.object({
  id: z.enum(ROUTE_OPTION_IDS),
  suitability: z.enum(['strong', 'possible', 'weak', 'unsuitable']),
  rationale: shortText(700),
  requirements: z.array(shortText(200)).max(6),
  advantages: z.array(shortText(200)).max(6),
  risks: z.array(shortText(200)).max(6),
  evidence: z.array(marketClaimSchema).max(4),
});

export const routeSchema = z.object({
  options: z.array(routeOptionSchema).min(2).max(6),
  primary: z.enum(ROUTE_OPTION_IDS),
  fallback: z.enum(ROUTE_OPTION_IDS),
  /** Why the primary fits *this* business, not why the route type exists. */
  recommendation: shortText(900),
  firstSteps: z.array(shortText(240)).min(1).max(6),
});

/* ──────────────────── 8. Pricing and commercial model ────────────────────── */

export const pricingSchema = z.object({
  /** What comparable products sell for, where a source said so. */
  researchedBenchmarks: z.array(marketClaimSchema).max(8),
  suggestedPositioning: shortText(800),
  /** Every assumption behind the numbers, stated in the customer's terms. */
  assumptions: z.array(shortText(300)).max(8),
  /** What could not be established, named rather than left blank. */
  missingData: z.array(shortText(200)).max(8),
  note: z.string().max(600).nullable(),
});

/* ───────────────── 9. Regulation and operational requirements ────────────── */

export const regulatoryRequirementSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  area: z.enum([
    'licence',
    'certification',
    'import',
    'labelling',
    'tax-customs',
    'restriction',
    'other',
  ]),
  title: shortText(200),
  detail: shortText(900),
  /**
   * The authority a reader should verify this with.
   *
   * Required, because the honest version of every statement in this section is
   * "this is what we found published, and here is who can confirm it".
   */
  verifyWith: shortText(200),
  evidence: z.array(marketClaimSchema).max(4),
  confidence,
});

export const regulationSchema = z.object({
  requirements: z.array(regulatoryRequirementSchema).max(12),
  /** Where the report could not reach an authority, said plainly. */
  gaps: z.array(shortText(300)).max(8),
});

/* ────────────────────────── 10. Risk register ────────────────────────────── */

export const riskSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  title: shortText(160),
  description: shortText(700),
  probability: z.enum(['high', 'medium', 'low']),
  impact: z.enum(['high', 'medium', 'low']),
  mitigation: shortText(600),
  evidence: z.array(marketClaimSchema).max(4),
  confidence,
});

/* ──────────────────── 11. 30/60/90-day entry plan ────────────────────────── */

export const PLAN_PHASES = ['days-1-30', 'days-31-60', 'days-61-90'] as const;
export type PlanPhase = (typeof PLAN_PHASES)[number];

export const PLAN_PHASE_LABEL: Record<PlanPhase, string> = {
  'days-1-30': 'Days 1–30 · Validation and preparation',
  'days-31-60': 'Days 31–60 · Partnerships and testing',
  'days-61-90': 'Days 61–90 · Controlled launch',
};

export const planActionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,60}$/),
  phase: z.enum(PLAN_PHASES),
  title: shortText(160),
  detail: shortText(700),
  priority: z.enum(['critical', 'high', 'normal']),
  owner: z.enum(['founder', 'operations', 'sales', 'marketing', 'external-adviser']),
  expectedOutcome: shortText(400),
  /** Another action's id, or null for something that can start immediately. */
  dependsOn: z.string().max(60).nullable(),
  reasoning: shortText(500),
});

export const planSchema = z.object({
  actions: z.array(planActionSchema).min(3).max(18),
});

/* ───────────────────── 12. Sources and limitations ───────────────────────── */

export const limitationSchema = z.object({
  area: shortText(140),
  detail: shortText(600),
  howToResolve: z.string().max(400).nullable(),
});

export const appendixSchema = z.object({
  limitations: z.array(limitationSchema).min(1).max(12),
  evidenceGaps: z.array(shortText(300)).max(10),
});

/* ─────────────────────────── The model's output ──────────────────────────── */

/**
 * What the model is asked for.
 *
 * Note the absences: no verdict, no readiness score, no margin scenario, no
 * evidence grade, no source list. Each is either computed from this output or
 * assembled from the job's own records, and asking for them here would be
 * asking the model to mark its own work.
 */
export const modelReportSchema = z.object({
  executive: executiveSchema,
  commercialContext: commercialContextSchema,
  marketSignals: marketSignalsSchema,
  competitive: competitiveSchema,
  customers: customersSchema,
  route: routeSchema,
  pricing: pricingSchema,
  regulation: regulationSchema,
  risks: z.array(riskSchema).max(12),
  plan: planSchema,
  appendix: appendixSchema,
});

export type ModelReport = z.infer<typeof modelReportSchema>;

/* ────────────────────── What this application computes ───────────────────── */

export const decisionSchema = z.object({
  businessName: z.string().max(200),
  productName: z.string().max(200),
  originCountry: z.string().length(2),
  targetCountry: z.string().length(2),
  targetRegion: z.string().max(160).nullable(),
  researchedAt: z.string(),
  verdict: z.enum(VERDICTS),
  confidence,
  /** 0–100, from lib/market-entry/scoring.ts. Never from prose. */
  readiness: z.number().int().min(0).max(100),
  /** Every factor that produced the score, so the number can be argued with. */
  factors: z.array(
    z.object({
      id: z.string().max(60),
      label: z.string().max(120),
      weight: z.number().min(0).max(1),
      score: z.number().min(0).max(1),
      explanation: z.string().max(300),
    }),
  ),
});

/**
 * Margin scenarios, computed from the customer's own figures.
 *
 * `null` where an input was not supplied. That is the whole reason this is a
 * separate structure rather than fields on the pricing section: a scenario the
 * model wrote is a scenario the model could invent, and the customer's unit
 * cost is not something to be plausible about.
 */
export const scenarioSchema = z.object({
  id: z.enum(['at-current-price', 'at-target-price', 'at-benchmark-midpoint']),
  label: z.string().max(120),
  currency: z.string().length(3),
  /** Integer minor units throughout. */
  sellingPriceMinor: z.number().int().nullable(),
  unitCostMinor: z.number().int().nullable(),
  grossMarginMinor: z.number().int().nullable(),
  grossMarginPercent: z.number().nullable(),
  /** Named inputs this scenario could not be computed without. */
  missingInputs: z.array(z.string().max(80)),
  note: z.string().max(300).nullable(),
});

/** One row of the rendered source appendix. */
export const marketSourceSchema = z.object({
  ref: sourceRefSchema,
  position: z.number().int().min(1),
  url: z.string().max(2000),
  title: z.string().max(300).nullable(),
  publisher: z.string().max(255).nullable(),
  category: sourceCategorySchema,
  retrievalMode: retrievalModeSchema,
  retrievedAt: z.string(),
  publishedAt: z.string().max(40).nullable(),
  geographicRelevance: geographicRelevanceSchema,
  excerpt: z.string().max(1200).nullable(),
  confidence,
  /** Report section ids this source is cited by. Computed, not declared. */
  supports: z.array(z.string().max(60)).max(24),
});

export type MarketSource = z.infer<typeof marketSourceSchema>;

/** A source we found but could not read, and why. Shown, not hidden. */
export const blockedSourceSchema = z.object({
  url: z.string().max(2000),
  publisher: z.string().max(255).nullable(),
  reason: z.enum([
    'robots-disallowed',
    'platform-policy',
    'unreachable',
    'timeout',
    'not-readable',
    'too-large',
    'blocked-by-site',
  ]),
});

export const coverageSchema = z.object({
  sourcesFound: z.number().int().min(0),
  sourcesAccepted: z.number().int().min(0),
  sourcesRejected: z.number().int().min(0),
  directlyRetrieved: z.number().int().min(0),
  fromIndexOnly: z.number().int().min(0),
  authoritative: z.number().int().min(0),
  distinctPublishers: z.number().int().min(0),
  blocked: z.array(blockedSourceSchema).max(30),
  /** Which of the ten investigation areas produced usable evidence. */
  areasCovered: z.array(z.string().max(60)).max(10),
  areasThin: z.array(z.string().max(60)).max(10),
});

/**
 * The grade assigned to every claim in the report, by path.
 *
 * Stored beside the report rather than inside each claim so the model's output
 * schema stays free of a field it must not control, and so re-grading a stored
 * report — if the derivation rules are ever corrected — does not require
 * rewriting the claims themselves.
 */
export const gradeIndexSchema = z.record(z.string(), z.enum(EVIDENCE_GRADES));

/* ───────────────────────── The stored report ─────────────────────────────── */

export const marketEntryReportSchema = modelReportSchema.extend({
  schemaVersion: z.literal(MARKET_ENTRY_SCHEMA_VERSION),
  decision: decisionSchema,
  scenarios: z.array(scenarioSchema).max(3),
  coverage: coverageSchema,
  grades: gradeIndexSchema,
  sources: z.array(marketSourceSchema).max(120),
});

export type MarketEntryReport = z.infer<typeof marketEntryReportSchema>;

/** The section ids, in render order. Shared by the nav, the print sheet and tests. */
export const REPORT_SECTIONS = [
  { id: 'decision', label: 'Decision' },
  { id: 'executive', label: 'Executive verdict' },
  { id: 'context', label: 'Commercial context' },
  { id: 'signals', label: 'Market signals' },
  { id: 'competitive', label: 'Competitive landscape' },
  { id: 'customers', label: 'Customers and buyers' },
  { id: 'route', label: 'Route to market' },
  { id: 'pricing', label: 'Pricing and margin' },
  { id: 'regulation', label: 'Regulation and operations' },
  { id: 'risks', label: 'Risk register' },
  { id: 'plan', label: '30/60/90-day plan' },
  { id: 'appendix', label: 'Sources and limitations' },
] as const;

export type ReportSectionId = (typeof REPORT_SECTIONS)[number]['id'];
