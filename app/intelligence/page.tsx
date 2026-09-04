import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Intelligence'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/intelligence');

  return (
    <WorkspaceShell
      kicker="Intelligence"
      title="What the outcomes say."
      intro="Conversion by territory, segment and objective, response by channel, and where evidence completeness pays off - always with sample sizes."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          No outcomes recorded yet. Insights compute from real recorded results only, and
          small samples are marked as such rather than charted as truth.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
