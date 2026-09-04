import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Meta } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getOutreachStore, type DraftRecord } from '@/lib/outreach/store';
import { getLeadStore } from '@/lib/leads/store';
import { OUTREACH_CHANNEL_LABEL } from '@/schemas/outreach';

export const metadata: Metadata = {
  title: pageTitle('Outreach'),
  robots: { index: false, follow: false },
};

/**
 * The review queue: drafts awaiting a human decision, then the approved
 * pile. Every row says what it is, who it is for, and whether it can be
 * approved yet. Nothing on this page — or anywhere — sends anything.
 */
export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireWorkspacePage('/outreach');
  const { status } = await searchParams;
  const shown = status === 'approved' || status === 'rejected' ? status : 'draft';

  const store = await getOutreachStore();
  const leads = await getLeadStore();
  const drafts = await store.listByStatus(shown);

  const withContext = await Promise.all(
    drafts.map(async (draft: DraftRecord) => {
      const account = await leads.getAccount(draft.accountId);
      const contact = draft.contactId ? await leads.getContact(draft.contactId) : null;
      return { draft, account, contact };
    }),
  );

  return (
    <WorkspaceShell
      kicker="Outreach"
      title="Drafts grounded in evidence, sent by people."
      intro="Every draft shows the evidence it used, requires human approval before it can be copied, and nothing sends automatically — not now, not by configuration."
      actions={
        <nav aria-label="Draft status" className="flex gap-2">
          {(['draft', 'approved', 'rejected'] as const).map((value) => (
            <Button
              key={value}
              asChild
              variant={shown === value ? 'primary' : 'secondary'}
              size="sm"
            >
              <Link href={value === 'draft' ? '/outreach' : `/outreach?status=${value}`}>
                {value === 'draft'
                  ? 'Awaiting review'
                  : value === 'approved'
                    ? 'Approved'
                    : 'Rejected'}
              </Link>
            </Button>
          ))}
        </nav>
      }
    >
      {withContext.length === 0 ? (
        <Panel className="mt-10 p-8 text-center">
          <p className="text-text font-medium">
            {shown === 'draft' ? 'No drafts awaiting review.' : `Nothing ${shown} yet.`}
          </p>
          <p className="text-text-muted mx-auto mt-2 max-w-md text-[14px] leading-relaxed">
            Drafts are generated from an account page, per contact, once discovery has
            gathered evidence to ground them in.
          </p>
        </Panel>
      ) : (
        <ul className="border-rule divide-rule mt-10 divide-y border">
          {withContext.map(({ draft, account, contact }) => (
            <li key={draft.id}>
              <Link
                href={`/outreach/${draft.id}`}
                className="hover:bg-ground-sunken flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-text text-[14px] font-medium">
                    {OUTREACH_CHANNEL_LABEL[draft.channel]}
                    {draft.language === 'ar' && (
                      <span className="text-text-subtle font-normal"> — Arabic</span>
                    )}
                  </p>
                  <p className="text-text-subtle mt-0.5 text-[13px]">
                    {account?.canonicalName ?? 'An account'}
                    {contact ? ` · ${contact.fullName}` : ''}
                  </p>
                </div>
                <Meta data-numeric>
                  v{draft.version} · {draft.updatedAt.slice(0, 10)}
                </Meta>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WorkspaceShell>
  );
}
