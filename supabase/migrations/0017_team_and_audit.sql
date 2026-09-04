-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: team membership and the audit trail
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0011 → 0016. Apply as
-- `team_and_audit`.
--
-- ALT SIGNAL is invitation-only. Having a Supabase account is not membership:
-- a signed-in user with no active row here sees a request-access holding page
-- and nothing else. Roles live in this table — server-controlled rows, read
-- per request — rather than in the JWT, so a role change or removal takes
-- effect on the next request instead of waiting out a stale token. The
-- legacy `app_metadata.role = 'admin'` claim is additionally honoured as
-- super_admin bootstrap, because someone has to be able to create the first
-- membership row.
--
--   · One workspace, implicitly: this is Arab Land Trading's internal tool,
--     not a multi-tenant platform, so there is no workspace_id to forget in
--     a query.
--   · Territory scoping is data (text[] of territory keys), enforced in the
--     store layer alongside role checks.
--   · Deactivate, not delete: a member who leaves keeps their name on the
--     audit history they created. status = 'revoked' removes all access.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.team_members (
  user_id      uuid primary key references auth.users(id) on delete cascade,

  role         text not null,
  display_name text not null,
  -- Territory keys this member is scoped to; empty means unrestricted
  -- (managers, analysts and admins typically see everything).
  territories  text[] not null default '{}',
  status       text not null default 'active',

  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint team_members_role check (
    role in ('super_admin', 'sales_manager', 'sales_rep', 'analyst', 'viewer')
  ),
  constraint team_members_status check (status in ('active', 'revoked')),
  constraint team_members_name_len check (char_length(display_name) between 1 and 120)
);

create index if not exists team_members_status_idx
  on public.team_members (status, role);

create trigger team_members_touch_updated_at
  before update on public.team_members
  for each row execute function public.rs_touch_updated_at();

alter table public.team_members enable row level security;
revoke all on public.team_members from anon, authenticated, public;
revoke all on public.team_members from service_role;
-- Membership is created, read, edited and revoked; never deleted by the
-- application. Removal rides the auth.users cascade.
grant select, insert, update on public.team_members to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- Audit events: who did what, to which entity, when.
--
-- Append-only. The application can write and read them; it can never update
-- or delete one — an audit trail that request-handling code can edit is a
-- notebook, not an audit trail. actor_id survives account deletion as null
-- with the display name frozen in the metadata at write time.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ops_audit_events (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  entity_kind text not null,
  entity_id   text,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now(),

  constraint ops_audit_events_action_len check (char_length(action) between 1 and 80),
  constraint ops_audit_events_entity_kind_len check (char_length(entity_kind) between 1 and 60),
  constraint ops_audit_events_entity_id_len check (
    entity_id is null or char_length(entity_id) <= 200
  )
);

create index if not exists ops_audit_events_entity_idx
  on public.ops_audit_events (entity_kind, entity_id, created_at desc);
create index if not exists ops_audit_events_actor_idx
  on public.ops_audit_events (actor_id, created_at desc);

alter table public.ops_audit_events enable row level security;
revoke all on public.ops_audit_events from anon, authenticated, public;
revoke all on public.ops_audit_events from service_role;
grant select, insert on public.ops_audit_events to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop table if exists public.ops_audit_events;
--   drop trigger if exists team_members_touch_updated_at on public.team_members;
--   drop table if exists public.team_members;
-- ═══════════════════════════════════════════════════════════════════════════
