-- ═══════════════════════════════════════════════════════════════════════════
-- Deliberate sharing
--
-- NOT YET APPLIED to the live project. Applied at deploy time, in order,
-- 0011 → 0016. Apply as `share_links`.
--
-- Until now a report URL was itself the sharing mechanism: sixteen characters
-- of entropy, and holding them was access. That made sharing free but made
-- un-sharing impossible — a link once sent could never expire and never be
-- revoked. This table replaces ambient capability with deliberate grants.
--
-- The security property everything else hangs on: THE TOKEN IS NEVER STORED.
-- The server mints a high-entropy token, hands it to the owner once, and keeps
-- only its SHA-256. A database read — by an attacker, a backup, a log
-- aggregator, an over-broad admin query — yields hashes that open nothing.
-- Lookup hashes the presented token and compares digests in constant time.
--
-- share_events is the audit trail: created / viewed / denied / revoked, with
-- the viewer's salted ip hash and never the token. Enough to answer "who has
-- been reading this and when did access stop", which is the question an owner
-- actually asks.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.share_links (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  job_id          uuid not null references public.research_jobs(id) on delete cascade,

  -- SHA-256 of the raw token, hex. The raw token exists only in the response
  -- that minted it.
  token_hash      text not null unique,
  -- Owner's note-to-self about who this went to. Optional, non-sensitive.
  label           text,
  allow_download  boolean not null default false,

  expires_at      timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  use_count       integer not null default 0,

  constraint share_links_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint share_links_label_len check (label is null or char_length(label) <= 120),
  constraint share_links_use_count_non_negative check (use_count >= 0)
);

-- The owner's share manager: links per report, newest first.
create index if not exists share_links_job_idx
  on public.share_links (job_id, created_at desc);
create index if not exists share_links_user_idx
  on public.share_links (user_id, created_at desc);

create table if not exists public.share_events (
  id          bigserial primary key,
  share_id    uuid not null references public.share_links(id) on delete cascade,
  event       text not null,
  -- Salted hash, same scheme the rate limiter uses. Never a raw address.
  ip_hash     text,
  created_at  timestamptz not null default now(),

  constraint share_events_event_known check (
    event in ('created', 'viewed', 'denied', 'revoked')
  )
);

create index if not exists share_events_share_idx
  on public.share_events (share_id, created_at desc);

alter table public.share_links  enable row level security;
alter table public.share_events enable row level security;

revoke all on public.share_links  from anon, authenticated, public;
revoke all on public.share_events from anon, authenticated, public;
revoke all on sequence public.share_events_id_seq from anon, authenticated, public;

-- Revocation and use-count are updates; a revoked link stays as audit. No
-- DELETE for request code.
revoke all on public.share_links from service_role;
grant select, insert, update on public.share_links to service_role;

-- Audit rows are append-and-read-only, like audit_events.
revoke all on public.share_events from service_role;
grant select, insert on public.share_events to service_role;
grant usage on sequence public.share_events_id_seq to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
--   drop table if exists public.share_events;
--   drop table if exists public.share_links;
-- ═══════════════════════════════════════════════════════════════════════════
