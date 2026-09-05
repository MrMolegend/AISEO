import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * The owner's workspace strip for one report.
 *
 * The dossier itself is a document; everything a returning owner does WITH it
 * — what-if arithmetic, the action workspace, the evidence explorer, sharing
 * — lives on sibling routes, and this strip is the wayfinding between them.
 * Owner-only by construction: the pages that render it only do so after an
 * owner-filtered read.
 */
const TABS = [
  { slug: '', label: 'Report' },
  { slug: 'scenarios', label: 'Scenario Lab' },
  { slug: 'actions', label: 'Actions' },
  { slug: 'evidence', label: 'Evidence' },
  { slug: 'sharing', label: 'Sharing' },
] as const;

export type OwnerTab = (typeof TABS)[number]['slug'];

export function OwnerToolbar({
  publicId,
  active,
}: {
  publicId: string;
  active: OwnerTab;
}) {
  return (
    <nav
      aria-label="Report workspace"
      className="border-rule mx-auto max-w-[var(--container-page)] border-b px-5 md:px-8 print:hidden"
    >
      <ul className="flex flex-wrap gap-x-1 overflow-x-auto">
        {TABS.map((tab) => {
          const current = tab.slug === active;
          return (
            <li key={tab.slug}>
              <Link
                href={`/research/${publicId}${tab.slug ? `/${tab.slug}` : ''}`}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-block border-b-2 px-3 py-2.5 text-[13px] transition-colors',
                  current
                    ? 'border-signal text-text'
                    : 'text-text-muted hover:text-text border-transparent',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
