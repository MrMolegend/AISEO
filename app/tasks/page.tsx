import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Tasks'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/tasks');

  return (
    <WorkspaceShell
      kicker="Tasks"
      title="What needs doing next."
      intro="Your queue across campaigns, accounts and playbooks, with due dates stated plainly."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          Nothing here yet. Tasks arrive from playbooks, assignments and your own notes on
          accounts.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
