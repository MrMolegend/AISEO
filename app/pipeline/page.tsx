import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Pipeline'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/pipeline');

  return (
    <WorkspaceShell
      kicker="Pipeline"
      title="From discovered to won, visibly."
      intro="Stages, owners, next actions and outcomes for every account being worked."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          The pipeline fills as leads are qualified and assigned. Stage history is kept,
          and bulk changes always confirm before they apply.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
