-- ═══════════════════════════════════════════════════════════════════════════
-- Research drafts
--
-- NOT YET APPLIED to the live project. Applied at deploy time, in order,
-- 0011 → 0016. Apply as `research_drafts`.
--
-- Server-backed intake progress. The intake previously kept its draft in
-- localStorage, which is exactly as durable as one browser profile on one
-- machine: a customer who started a brief on their laptop and opened their
-- phone found nothing. A draft is now a row the intake autosaves into.
--
-- Two properties do the real work:
--
--   · revision is an optimistic-concurrency counter. Every write states the
--     revision it read; a write carrying a stale revision changes nothing and
--     the store reports the conflict. Two tabs cannot silently overwrite each
--     other — the second one is told its copy is behind.
--   · A draft is mutable right up to submission and never after it. Submitting
--     validates the payload with the full brief schema, creates the job with
--     its own immutable input snapshot, and marks the draft 'submitted' with a
--     pointer to the job. The draft is provenance from then on, not state.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.research_drafts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  profile_id        uuid references public.business_profiles(id) on delete set null,

  -- The partial brief, exactly as the intake holds it. Validated loosely on
  -- every save (shape and bounds), strictly only at submission.
  payload           jsonb not null default '{}'::jsonb,
  revision          integer not null default 1,

  status            text not null default 'active',
  submitted_job_id  uuid references public.research_jobs(id) on delete set null,

  autosaved_at      timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint research_drafts_status_known check (
    status in ('active', 'submitted', 'discarded')
  ),
  constraint research_drafts_revision_positive check (revision >= 1)
);

-- "The drafts needing attention" on the dashboard, and "your most recent
-- active draft" when the intake opens.
create index if not exists research_drafts_user_idx
  on public.research_drafts (user_id, status, updated_at desc);

create trigger research_drafts_touch_updated_at
  before update on public.research_drafts
  for each row execute function public.rs_touch_updated_at();

alter table public.research_drafts enable row level security;

revoke all on public.research_drafts from anon, authenticated, public;

-- Discarding is a status write, so the application needs no DELETE here
-- either; rows leave through the auth.users cascade.
revoke all on public.research_drafts from service_role;
grant select, insert, update on public.research_drafts to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
--   drop trigger if exists research_drafts_touch_updated_at
--     on public.research_drafts;
--   drop table if exists public.research_drafts;
-- ═══════════════════════════════════════════════════════════════════════════
