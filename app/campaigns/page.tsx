import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Campaigns'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/campaigns');

  return (
    <WorkspaceShell
      kicker="Campaigns"
      title="Bounded research, deliberately started."
      intro="A campaign pairs an ideal customer profile with a territory and a product objective, previews its research cost, and runs within hard caps."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          No campaigns yet. Define an ideal customer profile first, then build a campaign
          from it; nothing spends before you confirm the preview.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
