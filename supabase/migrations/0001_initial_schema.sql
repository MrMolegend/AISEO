-- ═══════════════════════════════════════════════════════════════════════════
-- AISEO initial schema
--
-- Row Level Security is enabled from the first migration even though V1 has no
-- authentication. Adding RLS to a table that already has rows and clients is
-- painful; adding an owner_id predicate to a policy that already exists is one
-- line. The owner_id column is present and nullable for the same reason — when
-- accounts arrive, an anonymous audit is claimed by setting one field.
--
-- Privileges are declared explicitly at the end of this file rather than left to
-- the project's defaults. See the reasoning there: the defaults on this project
-- hand ALL privileges on new public tables to anon and authenticated, which is
-- the opposite of what this application wants.
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
-- Row Level Security and privileges
--
-- The application reaches Postgres exclusively through the service-role client,
-- on the server. Verified in the codebase: exactly one module imports
-- @supabase/supabase-js (lib/storage/supabase-store.ts), both of its clients are
-- constructed with the service-role key, and that module plus lib/storage/index.ts
-- and lib/env.ts each carry `import 'server-only'`, so a browser bundle importing
-- any of them is a build failure. NEXT_PUBLIC_SUPABASE_ANON_KEY is declared in
-- the env schema but referenced by no source file.
--
-- Public report pages are Server Components that look an audit up by exact
-- public_id. The 12-character id is the capability; it is never a filter applied
-- in the browser.
--
-- Therefore anon and authenticated need no access to any table here, and get
-- none.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.audits       enable row level security;
alter table public.leads        enable row level security;
alter table public.audit_events enable row level security;

-- No policies are defined, on purpose.
--
-- RLS enabled with zero policies denies every row to every non-bypassing role,
-- which is exactly right here: service_role holds BYPASSRLS, so the server keeps
-- working, and anon/authenticated are refused unconditionally.
--
-- An earlier draft of this migration carried:
--
--   create policy "completed audits are readable by link"
--     on public.audits for select using (status = 'complete');
--
-- That policy was removed rather than kept, because it did not do what its name
-- claimed. The predicate tests only `status`; public_id appears nowhere in it. Any
-- role holding SELECT on the table could therefore read EVERY completed audit,
-- not merely the one whose id it already knew — turning a capability URL into a
-- full listing of every site ever audited. The unguessable id only protects
-- anything when the lookup is constrained to it, which is what the server does
-- and what a status-only policy does not.
--
-- When accounts arrive, the owner predicate belongs here as
--   using (owner_id = auth.uid())
-- which is genuinely row-scoped, unlike the one this replaces.

-- ── Default privileges for future objects ─────────────────────────────────
--
-- This project grants ALL privileges on new public tables to anon and
-- authenticated by default (verified against pg_default_acl before writing this).
-- Without the following, every table created by a later migration is silently
-- exposed to the Data API the moment it exists, and RLS becomes the only thing
-- standing between an anonymous request and the data.
--
-- Revoking the defaults makes exposure opt-in: a future table that genuinely
-- needs browser access must say so explicitly, in a migration, in review.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- ── Revoke the privileges these tables already inherited ──────────────────
--
-- ALTER DEFAULT PRIVILEGES applies only to objects created after it runs. The
-- three tables above already exist by this point in the migration, so their
-- inherited grants must be revoked explicitly.
revoke all on public.audits       from anon, authenticated, public;
revoke all on public.leads        from anon, authenticated, public;
revoke all on public.audit_events from anon, authenticated, public;

revoke all on all sequences in schema public from anon, authenticated, public;

-- ── Grant service_role exactly what the application uses ──────────────────
--
-- Each grant below is traceable to a call site. No DELETE is granted anywhere:
-- nothing in the application deletes a row, and audit removal is a support
-- action performed with elevated credentials, not something the app can do.

-- lib/storage/supabase-store.ts
--   create()             → insert
--   getByPublicId(),
--   findFreshByUrlHash() → select
--   setStage(), complete(), fail() → update
grant select, insert, update on public.audits to service_role;

-- SupabaseLeadStore.create() → insert only. The audit lookup it performs first
-- reads public.audits, which is covered above.
grant select, insert on public.leads to service_role;

-- Not yet written to by application code. Granted because the table exists for
-- a declared purpose — a per-audit debugging timeline — and a table its only
-- client cannot use is worse than no table.
grant select, insert on public.audit_events to service_role;

-- audit_events.id is bigserial, so INSERT needs the sequence. audits.id and
-- leads.id are uuid defaults and need none.
grant usage, select on sequence public.audit_events_id_seq to service_role;
