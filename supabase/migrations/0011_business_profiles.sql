-- ═══════════════════════════════════════════════════════════════════════════
-- Business profiles
--
-- NOT YET APPLIED to the live project. Ships with the product-depth change and
-- is applied at deploy time, in order, 0011 → 0016. Apply as
-- `business_profiles`.
--
-- The durable description of what the customer sells, reusable across briefs.
-- Until now that description lived only inside each research job's input
-- snapshot: accurate for the report it produced, invisible to the next one.
-- A returning customer re-typed their business from scratch every time.
--
-- Design decisions that matter here:
--
--   · website_url is nullable and stays nullable. The product's standing
--     promise is that a website is never required; a profile without one is
--     complete, not deficient. When present it is one optional research seed.
--   · Multi-value answers are text[] rather than jsonb blobs, so they stay
--     queryable and bounded per element by the application schema.
--   · Archive, not delete: a profile that produced reports is part of their
--     provenance. archived_at set means hidden from pickers, never destroyed.
--     Account deletion removes it through the auth.users cascade.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.business_profiles (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,

  name               text not null,
  website_url        text,
  description        text,

  home_country       text,
  industry           text,
  offerings          text[] not null default '{}',
  target_customers   text[] not null default '{}',
  buyer_roles        text[] not null default '{}',
  business_model     text,
  price_positioning  text,
  sales_channels     text[] not null default '{}',
  traction_stage     text,
  team_capacity      text,
  differentiators    text[] not null default '{}',
  constraints_notes  text,
  goals              text[] not null default '{}',
  known_competitors  text[] not null default '{}',
  -- Facts the customer supplies directly, labelled as customer-provided
  -- evidence wherever they surface. Free text, bounded below.
  customer_evidence  text,

  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Bounds are a second line behind application validation, wide enough that
  -- the application's own limits are the ones a customer ever meets.
  constraint business_profiles_name_len check (char_length(name) between 1 and 160),
  constraint business_profiles_website_len check (
    website_url is null or char_length(website_url) <= 2048
  ),
  constraint business_profiles_description_len check (
    description is null or char_length(description) <= 4000
  ),
  constraint business_profiles_evidence_len check (
    customer_evidence is null or char_length(customer_evidence) <= 8000
  )
);

-- The picker and the profiles page both ask the same question: this user's
-- profiles, live first, most recently touched first.
create index if not exists business_profiles_user_idx
  on public.business_profiles (user_id, archived_at, updated_at desc);

create trigger business_profiles_touch_updated_at
  before update on public.business_profiles
  for each row execute function public.rs_touch_updated_at();

-- Same posture as every other table: RLS on with no policies, so the anon and
-- authenticated roles read nothing; access goes through the server's
-- service_role identity, and ownership is enforced in the store layer's
-- queries.
alter table public.business_profiles enable row level security;

revoke all on public.business_profiles from anon, authenticated, public;

-- The application creates, reads, edits and archives profiles; it never
-- deletes one. Removal happens through the auth.users cascade under a
-- privileged connection.
revoke all on public.business_profiles from service_role;
grant select, insert, update on public.business_profiles to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed. Safe while no research job references a profile; with 0013
-- applied, drop that column first.
--
--   drop trigger if exists business_profiles_touch_updated_at
--     on public.business_profiles;
--   drop table if exists public.business_profiles;
-- ═══════════════════════════════════════════════════════════════════════════
