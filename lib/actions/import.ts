import 'server-only';
import type { ResearchJobRecord } from '@/lib/jobs/store';
import { getActionItemStore, type ActionItemRecord } from '@/lib/actions/store';
import { marketEntryReportSchema } from '@/schemas/market-entry/report';
import { PlatformError } from '@/lib/errors';

/**
 * Report plan → workspace import.
 *
 * Copies the report's recommended actions into the customer's workspace,
 * once. Idempotency is the store's structural guarantee — the partial unique
 * index over (user, job, source action id) — so running this twice, or
 * retrying a run that died halfway, converges on one row per recommendation.
 * Rows the customer has since edited are left exactly as they are: the
 * import returns the existing row rather than writing anything.
 */

const OWNER_LABEL: Record<string, string> = {
  founder: 'Founder',
  operations: 'Operations',
  sales: 'Sales',
  marketing: 'Marketing',
  'external-adviser': 'External adviser',
};

export async function importPlanActions(
  userId: string,
  job: ResearchJobRecord,
): Promise<{ imported: ActionItemRecord[]; total: number }> {
  if (job.userId !== userId) {
    // Callers pass owner-filtered jobs; this is defence in depth, not a path.
    throw new PlatformError('NOT_FOUND', 'No such report');
  }

  const parsed = marketEntryReportSchema.safeParse(job.report);
  if (!parsed.success) {
    throw new PlatformError('NOT_FOUND', 'This report has no plan to import');
  }

  const store = await getActionItemStore();
  const imported: ActionItemRecord[] = [];

  for (const [index, action] of parsed.data.plan.actions.entries()) {
    imported.push(
      await store.create(userId, {
        jobId: job.id,
        profileId: job.profileId,
        sourceActionId: action.id,
        title: action.title,
        rationale: action.reasoning,
        phase: action.phase,
        priority: action.priority,
        ownerLabel: OWNER_LABEL[action.owner] ?? action.owner,
        notes: `${action.detail}\n\nExpected outcome: ${action.expectedOutcome}`,
        sortOrder: index,
        evidence: [
          {
            label: 'Recommended in the 30/60/90 plan',
            sectionId: 'plan',
          },
        ],
      }),
    );
  }

  return { imported, total: parsed.data.plan.actions.length };
}
