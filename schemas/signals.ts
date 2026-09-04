import { z } from 'zod';

/** Watchlists and signals: client-safe vocabulary and input schemas. */

export const SIGNAL_KINDS = [
  'new_opening',
  'expansion',
  'hiring',
  'assortment_change',
  'news_mention',
] as const;

export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const SIGNAL_KIND_LABEL: Record<SignalKind, string> = {
  new_opening: 'New opening',
  expansion: 'Expansion',
  hiring: 'Hiring',
  assortment_change: 'Assortment change',
  news_mention: 'News mention',
};

/**
 * A watch is one standing question. Account watches point at an account;
 * segment watches name a segment in a territory. The refinement mirrors the
 * database CHECK, so a shapeless watch never reaches the store.
 */
export const watchlistInputSchema = z
  .object({
    name: z.string().trim().min(1, { error: 'Name the watch.' }).max(120),
    kind: z.enum(['account', 'segment']),
    accountId: z.uuid().nullable().default(null),
    segmentKey: z.string().trim().max(80).nullable().default(null),
    territoryKey: z.string().trim().max(20).nullable().default(null),
  })
  .refine(
    (value) =>
      value.kind === 'account'
        ? value.accountId !== null
        : value.segmentKey !== null && value.territoryKey !== null,
    {
      error:
        'An account watch needs an account; a segment watch needs a segment and territory.',
    },
  );

export type WatchlistInput = z.infer<typeof watchlistInputSchema>;

/** How many bounded checks one watchlist may run per day. */
export const MAX_CHECKS_PER_WATCHLIST_PER_DAY = 3;
