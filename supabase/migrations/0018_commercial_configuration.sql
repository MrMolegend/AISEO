-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: commercial configuration and ideal customer profiles
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0017. Apply as
-- `commercial_configuration`.
--
-- The commercial facts that drive discovery, qualification and outreach are
-- DATA, not prompt text: territories, the brand catalogue, keyed
-- configuration (proof points, prohibited claims, tone rules, scoring
-- weights, budget caps) and reusable ideal customer profiles. Time-sensitive
-- claims carry their source and the date they were recorded, because "more
-- than 40 brands" is a fact about a moment, not a constant.
--
-- The brand catalogue ships EMPTY. No verified brand list was reachable at
-- build time, and seeding guesses would put invented facts under real
-- outreach. Administrators populate it; every row records who and when.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.alt_territories (
  key        text primary key,
  name       text not null,
  kind       text not null,
  parent_key text references public.alt_territories(key) on delete set null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),

  constraint alt_territories_key_len check (char_length(key) between 1 and 40),
  constraint alt_territories_name_len check (char_length(name) between 1 and 120),
  constraint alt_territories_kind check (kind in ('country', 'emirate', 'city', 'region'))
);

alter table public.alt_territories enable row level security;
revoke all on public.alt_territories from anon, authenticated, public;
revoke all on public.alt_territories from service_role;
grant select, insert, update on public.alt_territories to service_role;

-- The GCC starting set, recorded from the build specification (2026-09-03).
-- Administrators can deactivate or extend; deactivation is an update, so no
-- delete grant is needed.
insert into public.alt_territories (key, name, kind, parent_key) values
  ('AE', 'United Arab Emirates', 'country', null),
  ('SA', 'Saudi Arabia', 'country', null),
  ('QA', 'Qatar', 'country', null),
  ('KW', 'Kuwait', 'country', null),
  ('BH', 'Bahrain', 'country', null),
  ('OM', 'Oman', 'country', null),
  ('AE-AZ', 'Abu Dhabi', 'emirate', 'AE'),
  ('AE-DU', 'Dubai', 'emirate', 'AE'),
  ('AE-SH', 'Sharjah', 'emirate', 'AE'),
  ('AE-AJ', 'Ajman', 'emirate', 'AE'),
  ('AE-UQ', 'Umm Al Quwain', 'emirate', 'AE'),
  ('AE-RK', 'Ras Al Khaimah', 'emirate', 'AE'),
  ('AE-FU', 'Fujairah', 'emirate', 'AE')
on conflict (key) do nothing;


create table if not exists public.alt_brands (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique,
  categories        text[] not null default '{}',
  positioning       text,
  exclusivity_notes text,
  -- Where the row's facts came from and when. 'alt_admin' rows were entered
  -- by a person with authority; anything else needs re-verification dates.
  source            text not null default 'alt_admin',
  recorded_on       date not null default current_date,
  active            boolean not null default true,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint alt_brands_name_len check (char_length(name) between 1 and 120),
  constraint alt_brands_positioning check (
    positioning is null or positioning in ('premium', 'mid-market', 'value', 'mixed')
  ),
  constraint alt_brands_source check (
    source in ('alt_admin', 'build_specification', 'official_website', 'official_linkedin')
  ),
  constraint alt_brands_exclusivity_len check (
    exclusivity_notes is null or char_length(exclusivity_notes) <= 2000
  )
);

create trigger alt_brands_touch_updated_at
  before update on public.alt_brands
  for each row execute function public.rs_touch_updated_at();

alter table public.alt_brands enable row level security;
revoke all on public.alt_brands from anon, authenticated, public;
revoke all on public.alt_brands from service_role;
grant select, insert, update on public.alt_brands to service_role;


-- Keyed configuration: one row per concern, jsonb value validated by the
-- application schema for that key (schemas/alt-config.ts). Updates replace
-- the whole value; the audit trail keeps who changed what.
create table if not exists public.alt_config (
  key        text primary key,
  value      jsonb not null,
  source     text not null default 'alt_admin',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint alt_config_key_len check (char_length(key) between 1 and 60),
  constraint alt_config_source check (
    source in ('alt_admin', 'build_specification', 'official_website', 'official_linkedin')
  )
);

alter table public.alt_config enable row level security;
revoke all on public.alt_config from anon, authenticated, public;
revoke all on public.alt_config from service_role;
grant select, insert, update on public.alt_config to service_role;


-- Ideal customer profiles. The queryable spine is columns; the long tail of
-- criteria (category mix, procurement model, exclusions, target roles…) is
-- one bounded jsonb blob validated by schemas/icp.ts on every write — the
-- application never stores a shape it cannot re-read.
create table if not exists public.icps (
  id                  uuid primary key default gen_random_uuid(),
  created_by          uuid references auth.users(id) on delete set null,
  name                text not null,
  territory_keys      text[] not null default '{}',
  segment_keys        text[] not null default '{}',
  min_evidence_level  text not null default 'standard',
  max_accounts        integer not null default 25,
  max_contacts_per_account integer not null default 3,
  research_budget_units    integer not null default 50,
  criteria            jsonb not null default '{}',
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint icps_name_len check (char_length(name) between 1 and 160),
  constraint icps_evidence check (
    min_evidence_level in ('minimal', 'standard', 'strict')
  ),
  constraint icps_max_accounts check (max_accounts between 1 and 200),
  constraint icps_max_contacts check (max_contacts_per_account between 1 and 10),
  constraint icps_budget check (research_budget_units between 1 and 2000)
);

create index if not exists icps_active_idx
  on public.icps (archived_at, updated_at desc);

create trigger icps_touch_updated_at
  before update on public.icps
  for each row execute function public.rs_touch_updated_at();

alter table public.icps enable row level security;
revoke all on public.icps from anon, authenticated, public;
revoke all on public.icps from service_role;
grant select, insert, update on public.icps to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop trigger if exists icps_touch_updated_at on public.icps;
--   drop table if exists public.icps;
--   drop table if exists public.alt_config;
--   drop trigger if exists alt_brands_touch_updated_at on public.alt_brands;
--   drop table if exists public.alt_brands;
--   drop table if exists public.alt_territories;
-- ═══════════════════════════════════════════════════════════════════════════
