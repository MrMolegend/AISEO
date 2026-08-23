import 'server-only';
import { auditAnalysisSchema, type AuditAnalysis } from '@/schemas/audit';
import { crossReferenceAnalysis } from './cross-reference';
import { sanitizeAnalysis } from './sanitize';

/**
 * The validation layer.
 *
 * Deliberately separate from the provider: a component that could both produce
 * output and declare it valid would be marking its own homework. The provider
 * sends the model a non-strict tool schema — advisory, not compiled into a
 * decoding grammar — so the shape is requested rather than guaranteed, and the
 * tool input can be missing entirely. Even a perfectly-shaped payload could not
 * express coherence (a priority must reference an issue that exists) or safety
 * (no markup, no off-domain links). This layer is where both are enforced.
 *
 * Failures are returned as a list of human-readable problems rather than thrown,
 * because that list is exactly what the repair prompt needs.
 */

export type ValidationOutcome =
  | { ok: true; analysis: AuditAnalysis; sanitizedFields: string[] }
  | { ok: false; problems: string[] };

const MAX_REPORTED_PROBLEMS = 12;

export function validateAnalysis(raw: unknown, auditedDomain: string): ValidationOutcome {
  if (raw == null) {
    return { ok: false, problems: ['No audit was returned. The output was empty.'] };
  }

  const parsed = auditAnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.slice(0, MAX_REPORTED_PROBLEMS).map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    });
    if (parsed.error.issues.length > MAX_REPORTED_PROBLEMS) {
      problems.push(
        `…and ${parsed.error.issues.length - MAX_REPORTED_PROBLEMS} further schema problems.`,
      );
    }
    return { ok: false, problems };
  }

  // Coherence checks run before sanitising, so a rule violation is reported
  // against what the model actually produced.
  const crossReferenceProblems = crossReferenceAnalysis(parsed.data);
  if (crossReferenceProblems.length > 0) {
    return {
      ok: false,
      problems: crossReferenceProblems
        .slice(0, MAX_REPORTED_PROBLEMS)
        .map((problem) => problem.message),
    };
  }

  // Sanitising never fails the audit — a scrubbed string beats a lost report,
  // and the modified field list is recorded so injection attempts are visible
  // in the logs.
  const { analysis, report } = sanitizeAnalysis(parsed.data, auditedDomain);

  // Scrubbing can shorten a string below its schema minimum (a "finding" that
  // was almost entirely a link, for instance). Re-check rather than store
  // something that would fail to parse on read.
  const recheck = auditAnalysisSchema.safeParse(analysis);
  if (!recheck.success) {
    return {
      ok: false,
      problems: [
        'After removing markup and off-domain links, some fields no longer met their length requirements. Rewrite them as plain prose without embedded links or HTML.',
        ...recheck.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      ],
    };
  }

  return { ok: true, analysis: recheck.data, sanitizedFields: report.fieldsModified };
}
