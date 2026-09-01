import 'server-only';
import type { ResearchJobRecord } from '@/lib/jobs/store';
import type { VersionEntry } from '@/components/dossier/version-rail';

/**
 * Version numbering, derived rather than stored.
 *
 * A version number is a position in a profile's history: this profile's
 * completed market-entry runs, ordered by creation. Deriving it at read time
 * means it can never disagree with the rows it describes — a stored counter
 * would need every failure path to maintain it.
 *
 * Failed and cancelled runs are not versions; nobody compares against a
 * report that does not exist.
 */
export function versionsFrom(
  jobs: ResearchJobRecord[],
  currentPublicId: string,
): VersionEntry[] {
  const completed = jobs.filter(
    (job) => job.status === 'complete' && job.packageId === 'market-entry',
  );

  return completed.map((job, index) => {
    const decision = (job.report as { decision?: { verdict?: unknown } } | null)
      ?.decision;
    return {
      publicId: job.publicId,
      createdAt: job.createdAt,
      verdict: typeof decision?.verdict === 'string' ? decision.verdict : null,
      current: job.publicId === currentPublicId,
      number: index + 1,
    };
  });
}
