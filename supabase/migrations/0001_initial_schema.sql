-- ═══════════════════════════════════════════════════════════════════════════
-- AISEO initial schema
--
-- Row Level Security is enabled from the first migration even though V1 has no
-- authentication. Adding RLS to a table that already has rows and clients is
-- painful; adding an owner_id predicate to a policy that already exists is one
-- line. The owner_id column is present and nullable for the same reason — when
-- accounts arrive, an anonymous audit is claimed by setting one field.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── audits ────────────────────────────────────────────────────────────────
create table if not exists public.audits (
  -- Internal key, never exposed. public_id is what appears in a URL.
  id             uuid primary key default gen_random_uuid(),
  public_id      text unique not null,

  requested_url  text not null,
  normalized_url text not null,
  -- sha256 of normalized_url: the cache key, indexed for the freshness lookup.
  url_hash       text not null,
  domain         text not null,

  status         text not null default 'queued'
                   check (status in ('queued', 'running', 'complete', 'failed')),
  stage          text not null default 'queued',
  stage_index    integer not null default 0,

  -- A stable code from the audit error taxonomy, never a raw message: those can
  -- carry internal hostnames and stack detail.
  error_code     text,

  schema_version integer,
  overall_score  integer check (overall_score between 0 and 100),
  overall_rating text,
  facts          jsonb,
  analysis       jsonb,
  report_meta    jsonb,

  -- Ready for authentication; null for every anonymous audit.
  owner_id       uuid references auth.users(id) on delete set null,
  -- Salted hash only. Raw IPs are never stored.
  ip_hash        text,

  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

-- Cache lookup: most recent completed audit for a URL.
create index if not exists audits_url_hash_created_idx
  on public.audits (url_hash, created_at desc);

create index if not exists audits_domain_created_idx
  on public.audits (domain, created_at desc);

-- Supports the future "my audits" listing without another migration.
create index if not exists audits_owner_created_idx
  on public.audits (owner_id, created_at desc)
  where owner_id is not null;

-- Abuse investigation.
create index if not exists audits_ip_hash_created_idx
  on public.audits (ip_hash, created_at desc)
  where ip_hash is not null;

-- ── leads ─────────────────────────────────────────────────────────────────
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  audit_id   uuid references public.audits(id) on delete set null,
  name       text not null,
  email      text not null,
  company    text,
  website    text,
  message    text,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_idx on public.leads (created_at desc);

-- ── audit_events ──────────────────────────────────────────────────────────
-- Lightweight timeline for debugging a specific audit after the fact.
create table if not exists public.audit_events (
  id         bigserial primary key,
  audit_id   uuid not null references public.audits(id) on delete cascade,
  event      text not null,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_audit_idx
  on public.audit_events (audit_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Every write goes through the service-role client on the server, which bypasses
-- RLS. These policies therefore describe what an ANONYMOUS BROWSER may do, and
-- the answer is: read a finished audit, and nothing else.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.audits enable row level security;
alter table public.leads enable row level security;
alter table public.audit_events enable row level security;

-- Reports are public-by-link: the 12-character public_id is the capability.
-- An in-progress or failed audit is not readable, so a partially-written row
-- can never be scraped.
drop policy if exists "completed audits are readable by link" on public.audits;
create policy "completed audits are readable by link"
  on public.audits
  for select
  using (status = 'complete');

-- When accounts arrive this becomes:
--   using (status = 'complete' or owner_id = auth.uid())
-- and nothing else changes.

-- No anonymous access at all to leads or the event log.
-- Deliberately no policies: with RLS enabled and no policy, everything is denied.
