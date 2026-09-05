-- ═══════════════════════════════════════════════════════════════════════════
-- Report lineage, scenarios, feedback
--
-- NOT YET APPLIED to the live project. Applied at deploy time, in order,
-- 0011 → 0016. Apply as `report_lineage`.
--
-- Three small pieces that turn isolated runs into a history:
--
--   · research_jobs.profile_id ties a run to the business profile that seeded
--     it. Version numbering is derived at read time from the runs sharing a
--     profile, ordered by creation — a derived fact is one that cannot drift.
--     Nullable, set null on profile removal: legacy jobs and profile-less
--     briefs stay exactly as they are.
--   · report_scenarios stores the Scenario Lab's named what-ifs. Assumptions
--     are the user's, kept apart from the report's evidence by construction —
--     this table holds only assumption values, never report content.
--   · report_feedback is one verdict per user per report, updated in place.
--     The primary key is the upsert constraint, so "one user, one opinion,
--     revisable" is a property of the table rather than of route code.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.research_jobs
  add column if not exists profile_id uuid
    references public.business_profiles(id) on delete set null;

-- The version rail: this profile's runs, newest first.
create index if not exists research_jobs_profile_idx
  on public.research_jobs (profile_id, created_at desc)
  where profile_id is not null;

create table if not exists public.report_scenarios (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  job_id       uuid not null references public.research_jobs(id) on delete cascade,

  name         text not null,
  -- User-controlled assumption values only (budget, horizon, price point,
  -- conversion, demand range, capacity, channel mix, risk tolerance).
  assumptions  jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint report_scenarios_name_len check (char_length(name) between 1 and 80),
  -- One name per report keeps "update the scenario I saved" unambiguous.
  constraint report_scenarios_name_unique unique (job_id, name)
);

create index if not exists report_scenarios_user_idx
  on public.report_scenarios (user_id, updated_at desc);

create trigger report_scenarios_touch_updated_at
  before update on public.report_scenarios
  for each row execute function public.rs_touch_updated_at();

create table if not exists public.report_feedback (
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      uuid not null references public.research_jobs(id) on delete cascade,

  useful      boolean not null,
  category    text,
  comment     text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  primary key (user_id, job_id),

  constraint report_feedback_category_known check (
    category is null or category in
      ('accuracy', 'evidence', 'depth', 'clarity', 'actionability', 'other')
  ),
  constraint report_feedback_comment_len check (
    comment is null or char_length(comment) <= 2000
  )
);

create index if not exists report_feedback_job_idx
  on public.report_feedback (job_id, updated_at desc);

create trigger report_feedback_touch_updated_at
  before update on public.report_feedback
  for each row execute function public.rs_touch_updated_at();

alter table public.report_scenarios enable row level security;
alter table public.report_feedback  enable row level security;

revoke all on public.report_scenarios from anon, authenticated, public;
revoke all on public.report_feedback  from anon, authenticated, public;

-- Scenarios are the one new surface a user can hard-delete: an abandoned
-- what-if has no provenance value.
revoke all on public.report_scenarios from service_role;
grant select, insert, update, delete on public.report_scenarios to service_role;

-- Feedback is revised in place, never removed by request code.
revoke all on public.report_feedback from service_role;
grant select, insert, update on public.report_feedback to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
--   drop trigger if exists report_feedback_touch_updated_at
--     on public.report_feedback;
--   drop table if exists public.report_feedback;
--   drop trigger if exists report_scenarios_touch_updated_at
--     on public.report_scenarios;
--   drop table if exists public.report_scenarios;
--   drop index if exists public.research_jobs_profile_idx;
--   alter table public.research_jobs drop column if exists profile_id;
-- ═══════════════════════════════════════════════════════════════════════════
