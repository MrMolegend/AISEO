import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { DraftEditor } from '@/components/outreach/draft-editor';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getOutreachStore } from '@/lib/outreach/store';
import { lintDraftRecord } from '@/lib/outreach/service';
import { getLeadStore } from '@/lib/leads/store';
import { OUTREACH_CHANNEL_LABEL } from '@/schemas/outreach';

export const metadata: Metadata = {
  title: pageTitle('Draft'),
  robots: { index: false, follow: false },
};

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireWorkspacePage(`/outreach/${id}`);
  if (!UUID_SHAPE.test(id)) notFound();

  const store = await getOutreachStore();
  const draft = await store.get(id);
  if (!draft) notFound();

  const leads = await getLeadStore();
  const [account, contact, versions, violations] = await Promise.all([
    leads.getAccount(draft.accountId),
    draft.contactId ? leads.getContact(draft.contactId) : Promise.resolve(null),
    store.versions(id),
    lintDraftRecord(draft),
  ]);

  return (
    <WorkspaceShell
      kicker={`Outreach draft — ${draft.status}`}
      title={account?.canonicalName ?? 'Account'}
      intro={
        contact
          ? `For ${contact.fullName}${contact.roleTitle ? `, ${contact.roleTitle}` : ''}. Approval is your statement that every claim in the text is supportable.`
          : 'Approval is your statement that every claim in the text is supportable.'
      }
    >
      <div className="mt-10">
        <DraftEditor
          draft={{
            id: draft.id,
            channel: draft.channel,
            channelLabel: OUTREACH_CHANNEL_LABEL[draft.channel],
            language: draft.language,
            body: draft.body,
            status: draft.status,
            version: draft.version,
            evidenceRefs: draft.evidenceRefs.map((ref) => ({
              kind: ref.kind,
              text: ref.text,
            })),
          }}
          violations={violations}
          versions={versions.map((version) => ({
            version: version.version,
            createdAt: version.createdAt,
          }))}
        />
      </div>

      {account && (
        <p className="mt-12">
          <Link
            href={`/leads/${account.id}`}
            className="text-text-muted text-[13px] hover:underline"
          >
            ← Back to {account.canonicalName}
          </Link>
        </p>
      )}
    </WorkspaceShell>
  );
}
