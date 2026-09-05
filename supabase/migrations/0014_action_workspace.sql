-- ═══════════════════════════════════════════════════════════════════════════
-- Action workspace
--
-- NOT YET APPLIED to the live project. Applied at deploy time, in order,
-- 0011 → 0016. Apply as `action_workspace`.
--
-- The report's 30/60/90 plan is model output frozen inside a jsonb result; the
-- customer's actual execution of it is neither frozen nor model output. This
-- table is where the plan becomes theirs: each row starts as a copy of one
-- recommended action (or is created by hand) and then lives its own life —
-- edited, re-phased, re-ordered, completed, deferred, deleted.
--
-- The one subtle column is source_action_id: the id the report's plan gave the
-- recommendation this row was imported from. The partial unique index over
-- (user_id, job_id, source_action_id) is what makes "add this plan to my
-- workspace" idempotent — importing twice, or retrying a half-failed import,
-- cannot duplicate an action. Hand-written rows carry null and are exempt.
--
-- job_id and profile_id are provenance, not ownership: both set null on
-- removal so the workspace survives its sources. Ownership is user_id.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.action_items (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  job_id            uuid references public.research_jobs(id) on delete set null,
  profile_id        uuid references public.business_profiles(id) on delete set null,

  source_action_id  text,

  title             text not null,
  rationale         text,
  phase             text not null default 'days-1-30',
  status            text not null default 'todo',
  priority          text not null default 'normal',
  owner_label       text,
  due_date          date,
  notes             text,
  sort_order        integer not null default 0,
  -- Links back to the finding or sources that produced this action:
  -- [{label, url?, sectionId?}], bounded by the application schema.
  evidence          jsonb not null default '[]'::jsonb,

  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint action_items_phase_known check (
    phase in ('days-1-30', 'days-31-60', 'days-61-90', 'later')
  ),
  constraint action_items_status_known check (
    status in ('todo', 'in-progress', 'done', 'deferred')
  ),
  constraint action_items_priority_known check (
    priority in ('critical', 'high', 'normal')
  ),
  constraint action_items_title_len check (char_length(title) between 1 and 200),
  constraint action_items_rationale_len check (
    rationale is null or char_length(rationale) <= 1000
  ),
  constraint action_items_notes_len check (
    notes is null or char_length(notes) <= 4000
  ),
  constraint action_items_owner_len check (
    owner_label is null or char_length(owner_label) <= 80
  )
);

-- Import idempotency; see header.
create unique index if not exists action_items_import_unique
  on public.action_items (user_id, job_id, source_action_id)
  where source_action_id is not null and job_id is not null;

-- The workspace view: this user's actions by phase and position.
create index if not exists action_items_user_idx
  on public.action_items (user_id, phase, sort_order, created_at);

create trigger action_items_touch_updated_at
  before update on public.action_items
  for each row execute function public.rs_touch_updated_at();

alter table public.action_items enable row level security;

revoke all on public.action_items from anon, authenticated, public;

-- Users genuinely delete actions, so the application holds DELETE here — the
-- store's delete is filtered on user_id like every other query.
revoke all on public.action_items from service_role;
grant select, insert, update, delete on public.action_items to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
--   drop trigger if exists action_items_touch_updated_at
--     on public.action_items;
--   drop table if exists public.action_items;
-- ═══════════════════════════════════════════════════════════════════════════
