import {
  type AuditAnalysis,
  type AuditReport,
  ratingForScore,
  SCHEMA_VERSION,
  SEVERITY_ORDER,
  type AuditMeta,
} from '@/schemas/audit';
import { computeOverallScore } from './cross-reference';
import type { SiteFacts } from '@/schemas/facts';

/**
 * Assembles the stored report.
 *
 * The overall score is computed here from the weighted category scores rather
 * than taken from the model. That makes the number reproducible, keeps it
 * consistent with the breakdown shown beside it, and removes any chance of the
 * model contradicting itself between a headline figure and its own categories.
 */

const IMPACT_RANK = { high: 0, medium: 1, low: 2 } as const;
const EFFORT_RANK = { low: 0, medium: 1, high: 2 } as const;

export function buildReport(params: {
  publicId: string;
  url: string;
  domain: string;
  facts: SiteFacts;
  analysis: AuditAnalysis;
  meta: AuditMeta;
  createdAt?: string;
}): AuditReport {
  const analysis = sortAnalysis(params.analysis);
  const overallScore = computeOverallScore(analysis);

  return {
    schemaVersion: SCHEMA_VERSION,
    publicId: params.publicId,
    url: params.url,
    domain: params.domain,
    createdAt: params.createdAt ?? new Date().toISOString(),
    overallScore,
    overallRating: ratingForScore(overallScore),
    facts: params.facts,
    analysis,
    meta: params.meta,
  };
}

/**
 * Stable ordering, applied once at storage time.
 *
 * Sorting here rather than in the UI means every consumer — the report page, a
 * future PDF export, the OG image — sees the same order, and the model is never
 * asked to get presentation ordering right.
 */
export function sortAnalysis(analysis: AuditAnalysis): AuditAnalysis {
  const issues = [...analysis.issues].sort((a, b) => {
    const severity =
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severity !== 0) return severity;
    const impact = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
    if (impact !== 0) return impact;
    return EFFORT_RANK[a.effort] - EFFORT_RANK[b.effort];
  });

  const topPriorities = [...analysis.topPriorities].sort((a, b) => a.rank - b.rank);

  return { ...analysis, issues, topPriorities };
}
