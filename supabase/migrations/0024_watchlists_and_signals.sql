-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: watchlists and signals
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0023. Apply as
-- `watchlists_and_signals`.
--
-- A watchlist is a member's standing question — "tell me when something
-- happens around this account" or "around this segment in this territory".
-- Checking one is a bounded, budgeted act: one provider search, counted
-- against the same workspace daily research cap as campaign discovery, at
-- most a few times a day per watchlist. The bookkeeping columns on the
-- watchlist itself (last_checked_on, checks_today) are what make that
-- bound enforceable without a separate ledger table.
--
-- A signal is one sourced observation: a URL, its host, the words the page
-- used. Signals are deduplicated by (watchlist, url) so re-checking
-- converges instead of piling up copies, and they are never acted on
-- automatically — a signal is something a person reads.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.watchlists (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  kind            text not null,
  account_id      uuid references public.lead_accounts(id) on delete cascade,
  segment_key     text,
  territory_key   text,
  active          boolean not null default true,
  -- Check bookkeeping: how many bounded checks ran on the day named.
  last_checked_on date,
  checks_today    integer not null default 0,
  created_at      timestamptz not null default now(),

  constraint watchlists_name_len check (char_length(name) between 1 and 120),
  constraint watchlists_kind check (kind in ('account', 'segment')),
  -- An account watch names its account; a segment watch names its segment
  -- and territory. Neither shape leaves the subject ambiguous.
  constraint watchlists_subject check (
    (kind = 'account' and account_id is not null)
    or (kind = 'segment' and segment_key is not null and territory_key is not null)
  ),
  constraint watchlists_checks_today check (checks_today between 0 and 50)
);

create index if not exists watchlists_owner_idx
  on public.watchlists (owner_id, active);

alter table public.watchlists enable row level security;
revoke all on public.watchlists from anon, authenticated, public;
revoke all on public.watchlists from service_role;
grant select, insert, update, delete on public.watchlists to service_role;


create table if not exists public.signals (
  id          uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  account_id  uuid references public.lead_accounts(id) on delete set null,
  kind        text not null,
  title       text not null,
  url         text not null,
  source_host text not null,
  excerpt     text,
  dismissed   boolean not null default false,
  created_at  timestamptz not null default now(),

  constraint signals_kind check (
    kind in (
      'new_opening', 'expansion', 'hiring', 'assortment_change', 'news_mention'
    )
  ),
  constraint signals_title_len check (char_length(title) between 1 and 500),
  constraint signals_url_shape check (url like 'http%' and char_length(url) <= 2000),
  constraint signals_excerpt_len check (excerpt is null or char_length(excerpt) <= 2000)
);

-- Re-checking a watchlist converges: the same page never lands twice.
create unique index if not exists signals_dedup_unique
  on public.signals (watchlist_id, url);
create index if not exists signals_watchlist_idx
  on public.signals (watchlist_id, dismissed, created_at desc);

alter table public.signals enable row level security;
revoke all on public.signals from anon, authenticated, public;
revoke all on public.signals from service_role;
grant select, insert, update on public.signals to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop table if exists public.signals;
--   drop table if exists public.watchlists;
-- ═══════════════════════════════════════════════════════════════════════════
