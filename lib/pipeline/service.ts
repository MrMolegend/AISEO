import 'server-only';
import { getLeadStore } from '@/lib/leads/store';
import { getPipelineStore, type TaskRecord } from '@/lib/pipeline/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { PlatformError } from '@/lib/errors';
import { TERMINAL_STAGES, type PipelineStage } from '@/schemas/pipeline';

/**
 * Stage changes and playbooks.
 *
 * A stage change is one atomic story: the account moves, and the history
 * row says who, from, to and why. Applying a playbook creates its tasks
 * idempotently — the fingerprint index makes a second application converge
 * on the first — with due dates computed from today and the step offsets.
 */
export async function changeStage(input: {
  accountId: string;
  stage: PipelineStage;
  note: string;
  changedBy: string;
}): Promise<void> {
  const leads = await getLeadStore();
  const pipeline = await getPipelineStore();

  const account = await leads.getAccount(input.accountId);
  if (!account || account.status === 'merged') {
    throw new PlatformError('NOT_FOUND', 'No such account');
  }
  // Captured before the update: the memory driver hands back a live
  // reference, so reading it afterwards would see the new stage.
  const fromStage = account.pipelineStage;
  if (fromStage === input.stage) return;
  if (
    fromStage &&
    TERMINAL_STAGES.includes(fromStage as PipelineStage) &&
    !TERMINAL_STAGES.includes(input.stage)
  ) {
    // Reopening a settled account is allowed, but it deserves a reason.
    if (!input.note.trim()) {
      throw new PlatformError(
        'INVALID_INPUT',
        'Reopening a won, lost or disqualified account needs a note saying why.',
      );
    }
  }

  await leads.updateAccount(input.accountId, { pipelineStage: input.stage });
  await pipeline.recordStageChange({
    accountId: input.accountId,
    fromStage,
    toStage: input.stage,
    changedBy: input.changedBy,
    note: input.note,
  });
}

export async function applyPlaybook(input: {
  accountId: string;
  playbookKey: string;
  assigneeId: string;
  createdBy: string;
}): Promise<{ created: TaskRecord[]; existing: number }> {
  const leads = await getLeadStore();
  const pipeline = await getPipelineStore();
  const config = await getAltConfigStore();

  const account = await leads.getAccount(input.accountId);
  if (!account || account.status === 'merged') {
    throw new PlatformError('NOT_FOUND', 'No such account');
  }

  const playbooks = await config.getConfig('playbooks');
  const playbook = playbooks.find((candidate) => candidate.key === input.playbookKey);
  if (!playbook) throw new PlatformError('NOT_FOUND', 'No such playbook');

  const today = new Date();
  const created: TaskRecord[] = [];
  let existing = 0;

  for (const step of playbook.steps) {
    const due = new Date(today.getTime() + step.offsetDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const result = await pipeline.createTask({
      accountId: input.accountId,
      assigneeId: input.assigneeId,
      createdBy: input.createdBy,
      title: step.title,
      detail: step.detail || null,
      dueOn: due,
      playbookKey: playbook.key,
    });
    if (result.existed) existing += 1;
    else created.push(result.task);
  }

  return { created, existing };
}
