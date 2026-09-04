import type { Metadata } from 'next';
import Link from 'next/link';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import { Panel, Rule, Meta } from '@/components/ui/panel';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';
import { getRelationshipStore } from '@/lib/relationships/store';
import { getLeadStore } from '@/lib/leads/store';
import { RELATIONSHIP_STATE_LABEL } from '@/schemas/relationship';
import { capabilityReport } from '@/lib/linkedin/provider';

export const metadata: Metadata = {
  title: pageTitle('Relationships'),
  robots: { index: false, follow: false },
};

/**
 * The member's relationship record.
 *
 * Every edge shown here is something with provenance: this member's own
 * confirmations, each carrying its state label, note and age. The page
 * also states, in words, what the LinkedIn integration can and cannot do —
 * a warm-path product that implied connection data it does not have would
 * be lying by layout.
 */
export default async function RelationshipsPage() {
  const membership = await requireWorkspacePage('/relationships');

  const store = await getRelationshipStore();
  const leads = await getLeadStore();
  const edges = await store.forEmployee(membership.user.id);

  const rows = await Promise.all(
    edges.map(async (edge) => {
      const contact = await leads.getContact(edge.contactId);
      const account = contact ? await leads.getAccount(contact.accountId) : null;
      return { edge, contact, account };
    }),
  );

  const linkedIn = capabilityReport([]);

  return (
    <WorkspaceShell
      kicker="Relationships"
      title="Warm paths, with provenance."
      intro="Who at ALT provably knows whom. Every edge carries its source, its confirmer and its date; shared public context is never called a connection, and nothing here comes from scraping anything."
    >
      <Rule label="Your confirmations" className="mt-10" />
      {rows.length === 0 ? (
        <Panel className="mt-5 p-8">
          <p className="text-text-muted text-[14px] leading-relaxed">
            You have not confirmed or declined any contacts yet. On any account page, each
            decision-maker carries a quick &ldquo;Do you know this person?&rdquo; control
            — your answers appear here and become the workspace&rsquo;s warm paths.
          </p>
        </Panel>
      ) : (
        <ul className="border-rule divide-rule mt-5 divide-y border">
          {rows.map(({ edge, contact, account }) => (
            <li
              key={edge.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-text text-[14px] font-medium">
                  {contact?.fullName ?? 'A removed contact'}
                  {contact?.roleTitle && (
                    <span className="text-text-muted font-normal">
                      {' '}
                      — {contact.roleTitle}
                    </span>
                  )}
                </p>
                {account && (
                  <Link
                    href={`/leads/${account.id}`}
                    className="text-text-subtle text-[13px] hover:underline"
                  >
                    {account.canonicalName}
                  </Link>
                )}
                {edge.note && (
                  <p className="text-text-subtle mt-1 text-[13px]">{edge.note}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-text-muted text-[13px]">
                  {RELATIONSHIP_STATE_LABEL[edge.state]}
                </p>
                <Meta data-numeric>
                  {edge.confirmedAt
                    ? `Confirmed ${edge.confirmedAt.slice(0, 10)}`
                    : `Recorded ${edge.createdAt.slice(0, 10)}`}
                  {edge.expiresOn ? ` · re-confirm by ${edge.expiresOn}` : ''}
                </Meta>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Rule label="What LinkedIn can and cannot tell us" className="mt-14" />
      <Panel className="mt-5 p-6">
        <p className="text-text text-[14px] leading-relaxed">
          Mode: <span className="font-medium">{linkedIn.mode}</span>
          {linkedIn.mode !== 'disabled' &&
            (linkedIn.configured ? ' — configured' : ' — credentials incomplete')}
        </p>
        <ul className="text-text-muted mt-3 space-y-2 text-[13px] leading-relaxed">
          {linkedIn.notes.map((note) => (
            <li key={note.slice(0, 40)}>{note}</li>
          ))}
          <li>
            Warm paths therefore come from people: your confirmations, authorised imports,
            and recorded ALT history. Public profile links you see on accounts arrived
            from a search provider&rsquo;s public index and are labelled as such.
          </li>
        </ul>
      </Panel>
    </WorkspaceShell>
  );
}
