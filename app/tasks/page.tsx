import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { TaskList } from '@/components/tasks/task-list';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getPipelineStore } from '@/lib/pipeline/store';
import { getLeadStore } from '@/lib/leads/store';

export const metadata: Metadata = {
  title: pageTitle('Tasks'),
  robots: { index: false, follow: false },
};

/** The member's own queue: what needs doing next, due dates in words. */
export default async function TasksPage() {
  const membership = await requireWorkspacePage('/tasks');

  const pipeline = await getPipelineStore();
  const leads = await getLeadStore();
  const tasks = await pipeline.tasksForAssignee(membership.user.id, 'open');

  const withAccounts = await Promise.all(
    tasks.map(async (task) => ({
      id: task.id,
      title: task.title,
      detail: task.detail,
      dueOn: task.dueOn,
      accountId: task.accountId,
      accountName: task.accountId
        ? ((await leads.getAccount(task.accountId))?.canonicalName ?? null)
        : null,
      playbookKey: task.playbookKey,
    })),
  );

  return (
    <WorkspaceShell
      kicker="Tasks"
      title="What needs doing next."
      intro="Your queue across campaigns, accounts and playbooks, with due dates stated plainly. Playbooks schedule work for people; nothing here sends anything."
    >
      <div className="mt-10">
        <TaskList tasks={withAccounts} today={new Date().toISOString().slice(0, 10)} />
      </div>
    </WorkspaceShell>
  );
}
