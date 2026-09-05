import 'server-only';
import type { ActionItemRecord } from '@/lib/actions/store';
import type { WorkspaceAction } from '@/components/actions/action-workspace';
import { getResearchJobStore } from '@/lib/jobs/store';

/**
 * Stored action rows → the client workspace shape.
 *
 * The stored row carries the source job's uuid, which never reaches a
 * browser; the link back to the report is resolved here into the public id,
 * against the caller's own jobs only.
 */
export async function toWorkspaceActions(
  userId: string,
  actions: ActionItemRecord[],
): Promise<WorkspaceAction[]> {
  const jobs = await (await getResearchJobStore()).listForUser(userId, 100);
  const byId = new Map(jobs.map((job) => [job.id, job]));

  return actions.map((action) => {
    const source = action.jobId ? byId.get(action.jobId) : undefined;
    return {
      id: action.id,
      title: action.title,
      rationale: action.rationale,
      phase: action.phase,
      status: action.status,
      priority: action.priority,
      ownerLabel: action.ownerLabel,
      dueDate: action.dueDate,
      notes: action.notes,
      sortOrder: action.sortOrder,
      sourceHref: source ? `/research/${source.publicId}` : null,
      sourceLabel: source
        ? `From the ${source.subjectName} report`
        : action.sourceActionId
          ? 'From a report that has since been removed'
          : null,
    };
  });
}
