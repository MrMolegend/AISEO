import type { Metadata } from 'next';
import { WorkspaceShell } from '@/components/layout/workspace-shell';
import {
  WatchlistManager,
  type SignalView,
  type WatchlistView,
} from '@/components/signals/watchlist-manager';
import { getSignalStore } from '@/lib/signals/store';
import { getLeadStore } from '@/lib/leads/store';
import { getAltConfigStore } from '@/lib/alt/config-store';
import { DEFAULT_SEGMENTS, SEGMENT_LABEL, type SegmentKey } from '@/config/alt';
import { ROLES_WHO_WORK_LEADS } from '@/schemas/team';
import { pageTitle } from '@/config/brand';
import { requireWorkspacePage } from '@/lib/auth/workspace';

export const metadata: Metadata = {
  title: pageTitle('Watchlists'),
  robots: { index: false, follow: false },
};

export default async function Page() {
  const membership = await requireWorkspacePage('/watchlists', ...ROLES_WHO_WORK_LEADS);

  const [store, leads, config] = await Promise.all([
    getSignalStore(),
    getLeadStore(),
    getAltConfigStore(),
  ]);
  const [watchlists, signals, territories] = await Promise.all([
    store.listWatchlists(membership.user.id),
    store.openSignalsForOwner(membership.user.id),
    config.listTerritories(),
  ]);

  const territoryName = new Map(
    territories.map((territory) => [territory.key, territory.name]),
  );
  const watchlistName = new Map(
    watchlists.map((watchlist) => [watchlist.id, watchlist.name]),
  );

  const watchlistViews: WatchlistView[] = await Promise.all(
    watchlists.map(async (watchlist) => {
      let subjectLabel: string;
      if (watchlist.kind === 'account') {
        const account = watchlist.accountId
          ? await leads.getAccount(watchlist.accountId)
          : null;
        subjectLabel = account
          ? `Account: ${account.canonicalName}`
          : 'Account (removed)';
      } else {
        const segment =
          SEGMENT_LABEL[watchlist.segmentKey as SegmentKey] ?? watchlist.segmentKey ?? '';
        const territory =
          territoryName.get(watchlist.territoryKey ?? '') ?? watchlist.territoryKey ?? '';
        subjectLabel = `${segment} · ${territory}`;
      }
      return {
        id: watchlist.id,
        name: watchlist.name,
        kind: watchlist.kind,
        subjectLabel,
        lastCheckedOn: watchlist.lastCheckedOn,
        checksToday: watchlist.checksToday,
      };
    }),
  );

  const signalViews: SignalView[] = signals.map((signal) => ({
    id: signal.id,
    watchlistName: watchlistName.get(signal.watchlistId) ?? 'Watch',
    accountId: signal.accountId,
    kind: signal.kind,
    title: signal.title,
    url: signal.url,
    sourceHost: signal.sourceHost,
    excerpt: signal.excerpt,
    createdAt: signal.createdAt,
  }));

  return (
    <WorkspaceShell
      kicker="Watchlists"
      title="Standing questions, answered on your terms."
      intro="Watch an account or a segment in a territory. Checks are explicit, bounded and budgeted; a signal is a sourced observation to read, never an action taken for you."
    >
      <div className="mt-10">
        <WatchlistManager
          watchlists={watchlistViews}
          signals={signalViews}
          segments={DEFAULT_SEGMENTS.map((segment) => ({
            key: segment.key,
            label: segment.label,
          }))}
          territories={territories.map((territory) => ({
            key: territory.key,
            name: territory.name,
          }))}
        />
      </div>
    </WorkspaceShell>
  );
}
