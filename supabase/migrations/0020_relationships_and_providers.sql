-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: the relationship graph and provider connections
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0019. Apply as
-- `relationships_and_providers`.
--
-- Relationship edges have explicit provenance, and the CHECK constraint is
-- the vocabulary the UI is allowed to speak: "Verified direct connection"
-- copy is reserved for official_api_verified_direct and
-- employee_confirmed_direct, and nothing in the schema can promote a
-- public_shared_context row into either — only a person's confirmation or
-- an authorised API response writes those states.
--
-- provider_connections records an employee's own consented identity link
-- (today: LinkedIn OpenID). What was actually granted is stored as scope
-- strings; capability is derived from THESE, never from environment
-- configuration. No access or refresh token is stored: the OpenID flow
-- here needs the identity once, at link time, and keeping long-lived
-- tokens the product does not use would be pure liability.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.relationships (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references auth.users(id) on delete cascade,
  contact_id   uuid not null references public.lead_contacts(id) on delete cascade,

  state        text not null,
  -- Where this edge came from, in words a reader can audit.
  provenance   text not null default '',
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  confidence   text not null default 'medium',
  note         text,
  -- Relationships go stale: after this date the UI asks for reconfirmation.
  expires_on   date,
  visibility   text not null default 'workspace',

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint relationships_state check (
    state in (
      'official_api_verified_direct',
      'employee_confirmed_direct',
      'employee_confirmed_acquaintance',
      'crm_history',
      'previous_alt_interaction',
      'public_shared_context',
      'possible_unverified',
      'rejected_or_stale'
    )
  ),
  constraint relationships_confidence check (confidence in ('low', 'medium', 'high')),
  constraint relationships_visibility check (visibility in ('workspace', 'private')),
  constraint relationships_note_len check (note is null or char_length(note) <= 500),
  constraint relationships_provenance_len check (char_length(provenance) <= 500),
  constraint relationships_unique_edge unique (employee_id, contact_id)
);

create index if not exists relationships_contact_idx
  on public.relationships (contact_id, state);
create index if not exists relationships_employee_idx
  on public.relationships (employee_id, updated_at desc);

create trigger relationships_touch_updated_at
  before update on public.relationships
  for each row execute function public.rs_touch_updated_at();

alter table public.relationships enable row level security;
revoke all on public.relationships from anon, authenticated, public;
revoke all on public.relationships from service_role;
grant select, insert, update on public.relationships to service_role;


create table if not exists public.provider_connections (
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null,

  -- The provider's stable member identifier and the identity fields the
  -- granted scopes actually returned. Nothing else is stored.
  external_id   text,
  display_name  text,
  email         text,
  granted_scopes text[] not null default '{}',
  linked_at     timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (user_id, provider),
  constraint provider_connections_provider check (provider in ('linkedin')),
  constraint provider_connections_scopes_len check (
    array_length(granted_scopes, 1) is null or array_length(granted_scopes, 1) <= 20
  )
);

create trigger provider_connections_touch_updated_at
  before update on public.provider_connections
  for each row execute function public.rs_touch_updated_at();

alter table public.provider_connections enable row level security;
revoke all on public.provider_connections from anon, authenticated, public;
revoke all on public.provider_connections from service_role;
-- Delete is granted: disconnecting removes the stored identity entirely.
grant select, insert, update, delete on public.provider_connections to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop trigger if exists provider_connections_touch_updated_at
--     on public.provider_connections;
--   drop table if exists public.provider_connections;
--   drop trigger if exists relationships_touch_updated_at on public.relationships;
--   drop table if exists public.relationships;
-- ═══════════════════════════════════════════════════════════════════════════
