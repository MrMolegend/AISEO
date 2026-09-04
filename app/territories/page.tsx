import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Territories'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/territories');

  return (
    <WorkspaceShell
      kicker="Territories"
      title="Coverage across the UAE and GCC."
      intro="A schematic view of accounts, owners and whitespace by market and emirate - no external mapping service involved."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          The map lights up as accounts gain territories. Until then there is nothing true
          to draw.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
