import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Relationships'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/relationships');

  return (
    <WorkspaceShell
      kicker="Relationships"
      title="Warm paths, with provenance."
      intro="Who at ALT provably knows whom - every edge carries its source, its confirmer and its date, and nothing is called a connection on a name match."
    >
      <Panel className="mt-10 p-8">
        <p className="text-text-muted text-[14px] leading-relaxed">
          No relationship records yet. Paths appear as colleagues confirm contacts and as
          authorised imports arrive; unverified context is always labelled as such.
        </p>
      </Panel>
    </WorkspaceShell>
  );
}
