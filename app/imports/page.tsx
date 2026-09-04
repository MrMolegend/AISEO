import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { ImportWorkbench } from '@/components/imports/import-workbench';
import { ROLES_WHO_MANAGE_CAMPAIGNS } from '@/schemas/team';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Imports'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  await requireWorkspacePage('/imports', ...ROLES_WHO_MANAGE_CAMPAIGNS);

  return (
    <WorkspaceShell
      kicker="Imports"
      title="Bring your list in, honestly."
      intro="Paste or upload a CSV of accounts. You read exactly what it would do first - row by row, with duplicates and problems named - and committing the same file twice converges instead of duplicating."
    >
      <div className="mt-10">
        <ImportWorkbench />
      </div>
    </WorkspaceShell>
  );
}
