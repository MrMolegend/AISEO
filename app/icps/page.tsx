import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Ideal customer profiles'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/icps');

  return (
    <WorkspaceShell
      kicker="Ideal customer profiles"
      title="The accounts worth finding, described once."
      intro="Territory, segment, category mix, evidence bar and budget caps - reusable across campaigns."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          No profiles yet. The first campaign starts here: describe the customer worth
          finding and discovery inherits every constraint.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
