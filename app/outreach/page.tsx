import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Outreach'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/outreach');

  return (
    <WorkspaceShell
      kicker="Outreach"
      title="Drafts grounded in evidence, sent by people."
      intro="Every draft shows the evidence it used, requires human approval before copy or export, and nothing sends automatically."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          No drafts awaiting review. Drafts are generated per contact from an account page
          once discovery and relationship confirmation have run.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
