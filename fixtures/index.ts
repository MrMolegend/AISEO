import strongSite from './audits/strong-site.json';
import weakSite from './audits/weak-site.json';
import edgeCase from './audits/edge-case.json';
import { auditReportSchema, type AuditReport } from '@/schemas/audit';

/**
 * Fixture audits.
 *
 * These are hand-authored (edge-case is generated to sit exactly on the schema's
 * boundaries) and are the *only* data the report UI is developed against. Building
 * the presentation layer against fixtures rather than live model output means the
 * frontend is finishable before the AI pipeline exists, and gives us stable targets
 * for visual and accessibility regression.
 *
 * Parsing here rather than casting is deliberate: if a schema change breaks a
 * fixture, the failure surfaces at import in every test that touches them.
 */
export const FIXTURE_NAMES = ['strong-site', 'weak-site', 'edge-case'] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

const RAW: Record<FixtureName, unknown> = {
  'strong-site': strongSite,
  'weak-site': weakSite,
  'edge-case': edgeCase,
};

export function getFixtureReport(name: FixtureName): AuditReport {
  return auditReportSchema.parse(RAW[name]);
}

export function getRawFixture(name: FixtureName): unknown {
  return RAW[name];
}

/** The audit shown at /sample. A good-but-improvable site reads best as a demo. */
export const SAMPLE_FIXTURE: FixtureName = 'strong-site';
