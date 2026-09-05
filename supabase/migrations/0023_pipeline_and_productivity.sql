-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: pipeline, activities, tasks, saved views
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0022. Apply as
-- `pipeline_and_productivity`.
--
-- The sales pipeline is a second lifecycle on top of discovery: `status`
-- says what research established, `pipeline_stage` says where the selling
-- stands. Every stage change writes history — who, from, to, why — so time
-- in stage and loss reasons are queryable facts rather than folklore.
--
-- Tasks carry a playbook fingerprint with a partial unique index, so
-- applying the same playbook twice converges instead of duplicating the
-- checklist.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.lead_accounts
  add column if not exists pipeline_stage text,
  add column if not exists next_action text,
  add column if not exists due_on date,
  add column if not exists priority text;

alter table public.lead_accounts
  add constraint lead_accounts_pipeline_stage check (
    pipeline_stage is null or pipeline_stage in (
      'discovered', 'researching', 'qualified_stage', 'relationship_confirmation',
      'ready_for_outreach', 'contacted', 'replied', 'meeting_booked',
      'sample_requested', 'commercial_discussion', 'customer_won', 'nurture',
      'disqualified', 'lost'
    )
  ),
  add constraint lead_accounts_priority check (
    priority is null or priority in ('high', 'medium', 'low')
  ),
  add constraint lead_accounts_next_action_len check (
    next_action is null or char_length(next_action) <= 500
  );

create index if not exists lead_accounts_pipeline_idx
  on public.lead_accounts (pipeline_stage, due_on)
  where pipeline_stage is not null;


create table if not exists public.pipeline_history (
  id         bigint generated always as identity primary key,
  account_id uuid not null references public.lead_accounts(id) on delete cascade,
  from_stage text,
  to_stage   text not null,
  changed_by uuid references auth.users(id) on delete set null,
  note       text not null default '',
  created_at timestamptz not null default now(),

  constraint pipeline_history_note_len check (char_length(note) <= 1000)
);

create index if not exists pipeline_history_account_idx
  on public.pipeline_history (account_id, created_at desc);

alter table public.pipeline_history enable row level security;
revoke all on public.pipeline_history from anon, authenticated, public;
revoke all on public.pipeline_history from service_role;
grant select, insert on public.pipeline_history to service_role;


create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  account_id  uuid not null references public.lead_accounts(id) on delete cascade,
  contact_id  uuid references public.lead_contacts(id) on delete set null,
  author_id   uuid references auth.users(id) on delete set null,
  kind        text not null default 'note',
  body        text not null,
  -- Private notes are the author's; everything else is workspace-visible.
  private     boolean not null default false,
  happened_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),

  constraint activities_kind check (
    kind in ('note', 'call', 'meeting', 'email', 'whatsapp', 'linkedin', 'other')
  ),
  constraint activities_body_len check (char_length(body) between 1 and 4000)
);

create index if not exists activities_account_idx
  on public.activities (account_id, happened_at desc);

alter table public.activities enable row level security;
revoke all on public.activities from anon, authenticated, public;
revoke all on public.activities from service_role;
grant select, insert on public.activities to service_role;


create table if not exists public.sales_tasks (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid references public.lead_accounts(id) on delete set null,
  assignee_id  uuid references auth.users(id) on delete set null,
  created_by   uuid references auth.users(id) on delete set null,
  title        text not null,
  detail       text,
  due_on       date,
  status       text not null default 'open',
  -- The playbook fingerprint: (account, playbook, title) is unique while
  -- both halves are present, so re-applying a playbook converges.
  playbook_key text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  completed_at timestamptz,

  constraint sales_tasks_title_len check (char_length(title) between 1 and 300),
  constraint sales_tasks_detail_len check (detail is null or char_length(detail) <= 2000),
  constraint sales_tasks_status check (status in ('open', 'done', 'dropped'))
);

create unique index if not exists sales_tasks_playbook_unique
  on public.sales_tasks (account_id, playbook_key, title)
  where playbook_key is not null and account_id is not null;
create index if not exists sales_tasks_assignee_idx
  on public.sales_tasks (assignee_id, status, due_on);

create trigger sales_tasks_touch_updated_at
  before update on public.sales_tasks
  for each row execute function public.rs_touch_updated_at();

alter table public.sales_tasks enable row level security;
revoke all on public.sales_tasks from anon, authenticated, public;
revoke all on public.sales_tasks from service_role;
grant select, insert, update on public.sales_tasks to service_role;


create table if not exists public.saved_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  path       text not null,
  created_at timestamptz not null default now(),

  constraint saved_views_name_len check (char_length(name) between 1 and 80),
  -- A saved view is a same-site path with its filters, nothing else.
  constraint saved_views_path_shape check (path like '/%' and char_length(path) <= 600),
  constraint saved_views_unique unique (user_id, name)
);

alter table public.saved_views enable row level security;
revoke all on public.saved_views from anon, authenticated, public;
revoke all on public.saved_views from service_role;
grant select, insert, delete on public.saved_views to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop table if exists public.saved_views;
--   drop trigger if exists sales_tasks_touch_updated_at on public.sales_tasks;
--   drop table if exists public.sales_tasks;
--   drop table if exists public.activities;
--   drop table if exists public.pipeline_history;
--   alter table public.lead_accounts
--     drop constraint if exists lead_accounts_pipeline_stage,
--     drop constraint if exists lead_accounts_priority,
--     drop constraint if exists lead_accounts_next_action_len,
--     drop column if exists pipeline_stage,
--     drop column if exists next_action,
--     drop column if exists due_on,
--     drop column if exists priority;
-- ═══════════════════════════════════════════════════════════════════════════
