import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Lead explorer'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/leads');

  return (
    <WorkspaceShell
      kicker="Lead explorer"
      title="Every account, one working surface."
      intro="Search, filter and work the accounts discovery has found, with evidence and freshness beside every claim."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          No accounts yet. Run a discovery campaign and qualified candidates land here
          with their sources attached; accounts can also arrive through an authorised
          import.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
