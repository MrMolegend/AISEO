-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: campaigns, discovery runs, lead accounts, claims, contacts
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0018. Apply as
-- `campaigns_and_leads`.
--
-- The shape encodes the product's honesty rules:
--
--   · lead_accounts.website_url is nullable and never required — discovery
--     works from directories, news, marketplaces and indexed search.
--   · Every material claim about an account is a lead_claims row carrying
--     its source URL, category, retrieval mode, confidence and timestamps.
--     There is no column for an unsourced fact.
--   · lead_contacts stores business-relevant professional data only, with
--     employment_confidence defaulting to 'unverified'. Nothing here can
--     hold a fabricated email pattern: contact_channel is free of defaults
--     and the engine only writes what a source actually published.
--   · Dedup never merges on name similarity alone: normalized_name equality
--     or same canonical domain, and manual merges keep history in
--     account_merges with an undo.
--   · One active run per campaign, structurally (partial unique index).
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.campaigns (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid references auth.users(id) on delete set null,
  owner_id        uuid references auth.users(id) on delete set null,
  icp_id          uuid references public.icps(id) on delete set null,

  name            text not null,
  objective       text not null default '',
  territory_keys  text[] not null default '{}',
  language        text not null default 'en',
  status          text not null default 'draft',

  max_accounts    integer not null default 25,
  max_contacts_per_account integer not null default 3,
  budget_units    integer not null default 50,

  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint campaigns_name_len check (char_length(name) between 1 and 160),
  constraint campaigns_objective_len check (char_length(objective) <= 2000),
  constraint campaigns_language check (language in ('en', 'ar', 'both')),
  constraint campaigns_status check (
    status in ('draft', 'running', 'completed', 'partial', 'failed', 'cancelled', 'archived')
  ),
  constraint campaigns_max_accounts check (max_accounts between 1 and 200),
  constraint campaigns_max_contacts check (max_contacts_per_account between 1 and 10),
  constraint campaigns_budget check (budget_units between 1 and 2000)
);

create index if not exists campaigns_status_idx
  on public.campaigns (status, updated_at desc);

create trigger campaigns_touch_updated_at
  before update on public.campaigns
  for each row execute function public.rs_touch_updated_at();

alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon, authenticated, public;
revoke all on public.campaigns from service_role;
grant select, insert, update on public.campaigns to service_role;


create table if not exists public.campaign_runs (
  id             uuid primary key default gen_random_uuid(),
  campaign_id    uuid not null references public.campaigns(id) on delete cascade,
  started_by     uuid references auth.users(id) on delete set null,

  status         text not null default 'queued',
  stage          text not null default 'queued',
  error_code     text,
  attempt_count  integer not null default 1,
  heartbeat_at   timestamptz,

  units_budget   integer not null default 0,
  units_spent    integer not null default 0,
  accounts_found integer not null default 0,
  accounts_qualified integer not null default 0,
  contacts_found integer not null default 0,

  -- Stage-level resume data: which account ids each per-account stage has
  -- already processed, so a retry never re-spends on finished work.
  checkpoint     jsonb not null default '{}',

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  finished_at    timestamptz,

  constraint campaign_runs_status check (
    status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled')
  ),
  constraint campaign_runs_units check (units_spent >= 0 and units_budget >= 0)
);

-- One live run per campaign, enforced by the database rather than a check
-- the application could race past.
create unique index if not exists campaign_runs_one_active
  on public.campaign_runs (campaign_id)
  where status in ('queued', 'running');

-- The stall sweep asks for non-terminal runs with old heartbeats.
create index if not exists campaign_runs_stall_idx
  on public.campaign_runs (heartbeat_at)
  where status in ('queued', 'running');

create trigger campaign_runs_touch_updated_at
  before update on public.campaign_runs
  for each row execute function public.rs_touch_updated_at();

alter table public.campaign_runs enable row level security;
revoke all on public.campaign_runs from anon, authenticated, public;
revoke all on public.campaign_runs from service_role;
grant select, insert, update on public.campaign_runs to service_role;


create table if not exists public.lead_accounts (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid references public.campaigns(id) on delete set null,
  icp_id          uuid references public.icps(id) on delete set null,
  owner_id        uuid references auth.users(id) on delete set null,

  canonical_name  text not null,
  -- Lowercased, whitespace-collapsed, punctuation-stripped. The dedup key,
  -- alongside domain. Never a fuzzy match.
  normalized_name text not null,
  domain          text,
  website_url     text,
  segment_key     text,
  territory_key   text,
  city            text,

  status          text not null default 'candidate',
  summary         text,
  fit_rationale   text,
  merged_into     uuid references public.lead_accounts(id) on delete set null,

  discovered_at   timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint lead_accounts_name_len check (char_length(canonical_name) between 1 and 200),
  constraint lead_accounts_status check (
    status in ('candidate', 'research_needed', 'qualified', 'rejected', 'merged')
  ),
  constraint lead_accounts_summary_len check (summary is null or char_length(summary) <= 4000),
  constraint lead_accounts_fit_len check (
    fit_rationale is null or char_length(fit_rationale) <= 4000
  )
);

create index if not exists lead_accounts_campaign_idx
  on public.lead_accounts (campaign_id, status);
create index if not exists lead_accounts_dedup_idx
  on public.lead_accounts (normalized_name);
create index if not exists lead_accounts_domain_idx
  on public.lead_accounts (domain) where domain is not null;
create index if not exists lead_accounts_status_idx
  on public.lead_accounts (status, updated_at desc);

create trigger lead_accounts_touch_updated_at
  before update on public.lead_accounts
  for each row execute function public.rs_touch_updated_at();

alter table public.lead_accounts enable row level security;
revoke all on public.lead_accounts from anon, authenticated, public;
revoke all on public.lead_accounts from service_role;
grant select, insert, update on public.lead_accounts to service_role;


create table if not exists public.lead_claims (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references public.lead_accounts(id) on delete cascade,

  kind            text not null,
  text            text not null,
  source_url      text not null,
  source_title    text,
  source_category text not null,
  retrieval_mode  text not null default 'indexed',
  confidence      text not null default 'low',
  content_date    date,
  retrieved_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  constraint lead_claims_kind check (kind in ('identity', 'fit', 'contact', 'signal')),
  constraint lead_claims_text_len check (char_length(text) between 1 and 1000),
  constraint lead_claims_url_len check (char_length(source_url) <= 2048),
  constraint lead_claims_category check (
    source_category in (
      'company_website', 'public_directory', 'trade_association', 'marketplace',
      'news', 'event_listing', 'public_search_index', 'user_import',
      'employee_confirmation', 'official_linkedin_api', 'alt_internal', 'inference'
    )
  ),
  constraint lead_claims_mode check (retrieval_mode in ('indexed', 'direct')),
  constraint lead_claims_confidence check (confidence in ('low', 'medium', 'high'))
);

create index if not exists lead_claims_account_idx
  on public.lead_claims (account_id, kind);

alter table public.lead_claims enable row level security;
revoke all on public.lead_claims from anon, authenticated, public;
revoke all on public.lead_claims from service_role;
-- Claims are evidence: written and read, corrected by delete-and-rewrite
-- under an explicit user action (delete is granted for that path alone).
grant select, insert, delete on public.lead_claims to service_role;


create table if not exists public.lead_contacts (
  id                   uuid primary key default gen_random_uuid(),
  account_id           uuid not null references public.lead_accounts(id) on delete cascade,

  full_name            text not null,
  role_title           text,
  profile_url          text,
  company_bio_url      text,
  -- A lawful, publicly published business channel, verbatim from its
  -- source. Never derived, never guessed.
  contact_channel      text,
  source_url           text,
  source_category      text not null default 'public_search_index',
  employment_confidence text not null default 'unverified',
  last_verified_on     date,
  role_relevance       text,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint lead_contacts_name_len check (char_length(full_name) between 1 and 160),
  constraint lead_contacts_role_len check (
    role_title is null or char_length(role_title) <= 200
  ),
  constraint lead_contacts_category check (
    source_category in (
      'company_website', 'public_directory', 'news', 'public_search_index',
      'user_import', 'employee_confirmation', 'official_linkedin_api'
    )
  ),
  constraint lead_contacts_employment check (
    employment_confidence in ('verified', 'likely', 'unverified')
  ),
  constraint lead_contacts_relevance_len check (
    role_relevance is null or char_length(role_relevance) <= 500
  )
);

create index if not exists lead_contacts_account_idx
  on public.lead_contacts (account_id);

create trigger lead_contacts_touch_updated_at
  before update on public.lead_contacts
  for each row execute function public.rs_touch_updated_at();

alter table public.lead_contacts enable row level security;
revoke all on public.lead_contacts from anon, authenticated, public;
revoke all on public.lead_contacts from service_role;
grant select, insert, update, delete on public.lead_contacts to service_role;


create table if not exists public.account_merges (
  id         uuid primary key default gen_random_uuid(),
  winner_id  uuid not null references public.lead_accounts(id) on delete cascade,
  loser_id   uuid not null references public.lead_accounts(id) on delete cascade,
  merged_by  uuid references auth.users(id) on delete set null,
  reason     text not null default '',
  undone_at  timestamptz,
  created_at timestamptz not null default now(),

  constraint account_merges_reason_len check (char_length(reason) <= 500),
  constraint account_merges_distinct check (winner_id <> loser_id)
);

create index if not exists account_merges_winner_idx
  on public.account_merges (winner_id, created_at desc);

alter table public.account_merges enable row level security;
revoke all on public.account_merges from anon, authenticated, public;
revoke all on public.account_merges from service_role;
grant select, insert, update on public.account_merges to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop table if exists public.account_merges;
--   drop trigger if exists lead_contacts_touch_updated_at on public.lead_contacts;
--   drop table if exists public.lead_contacts;
--   drop table if exists public.lead_claims;
--   drop trigger if exists lead_accounts_touch_updated_at on public.lead_accounts;
--   drop table if exists public.lead_accounts;
--   drop trigger if exists campaign_runs_touch_updated_at on public.campaign_runs;
--   drop table if exists public.campaign_runs;
--   drop trigger if exists campaigns_touch_updated_at on public.campaigns;
--   drop table if exists public.campaigns;
-- ═══════════════════════════════════════════════════════════════════════════
