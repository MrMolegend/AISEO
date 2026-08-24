-- ═══════════════════════════════════════════════════════════════════════════
-- Research platform: accounts, token wallets, ledger, jobs and sources
--
-- Purely additive. The audits, leads and audit_events tables from 0001 are
-- untouched and their data is preserved — the SEO product's records are real
-- production data and this migration has no business deleting them.
--
-- Two things in here carry the weight of the whole feature, and both are
-- deliberately in the database rather than in application code:
--
--   1. Balances move only inside functions that take a row lock. The
--      application is structurally unable to perform "read balance, decide in
--      JavaScript, write new balance" — the three-step race that lets two
--      concurrent requests spend the same tokens. There is no UPDATE grant on
--      token_wallets for the application role, so the only way a balance can
--      change is through a function that locks first.
--
--   2. The ledger is append-only, enforced by triggers rather than by grants
--      alone. Grants would be bypassed by the SECURITY DEFINER functions here,
--      which run as the owner; a trigger stops everyone, including them.
--
-- Naming: functions are prefixed rs_ so they are obviously ours in a schema
-- that also contains Supabase's own.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- Enumerated domains
--
-- Kept as CHECK constraints over text rather than Postgres enums. Adding a
-- value to an enum is a DDL change that cannot run inside a transaction with
-- other statements in older Postgres and is awkward to reverse; a CHECK is a
-- one-line ALTER. The set is small and stable enough that neither choice is
-- costly, and the constraint still refuses an unknown value.
-- ───────────────────────────────────────────────────────────────────────────


-- ── User profiles ─────────────────────────────────────────────────────────
--
-- Deliberately thin. Supabase Auth owns identity, email and confirmation
-- state; duplicating any of it here would create two sources of truth for the
-- same fact. This table holds only what the product adds on top.
create table if not exists public.user_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint user_profiles_display_name_len check (
    display_name is null or char_length(display_name) between 1 and 80
  )
);


-- ── Token wallets ─────────────────────────────────────────────────────────
--
-- One row per user, created on first authenticated request.
--
-- available_balance is what the user can spend right now. reserved_balance is
-- held against jobs that are still running. Splitting them is what makes a
-- crashed job visible rather than silent: the tokens are neither spendable nor
-- quietly gone, and the wallet page can say so.
--
-- Both carry non-negative CHECK constraints. Those are the last line rather
-- than the first — rs_reserve_tokens refuses an overdraft before it ever gets
-- here — but if a future function forgets, the constraint turns a wrong balance
-- into a failed transaction instead of a debt.
create table if not exists public.token_wallets (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  available_balance integer not null default 0,
  reserved_balance  integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint token_wallets_available_non_negative check (available_balance >= 0),
  constraint token_wallets_reserved_non_negative  check (reserved_balance  >= 0)
);


-- ── Research jobs ─────────────────────────────────────────────────────────
--
-- public_id is the capability: 16 URL-safe characters, ~95 bits. It is the only
-- identifier that ever reaches a browser or a shared link. The uuid primary key
-- stays internal so that guessing a job's storage identity buys nothing.
--
-- input_hash covers every material input, not just the domain — see
-- lib/research/cache-key.ts. Two users researching the same company with
-- different questions must not share a cached report, because the inputs are
-- the user's own text.
create table if not exists public.research_jobs (
  id                 uuid primary key default gen_random_uuid(),
  public_id          text not null unique,
  user_id            uuid not null references auth.users(id) on delete cascade,

  package_id         text not null,
  token_cost         integer not null,

  -- Exactly what the user submitted, after server-side validation.
  input              jsonb not null,
  -- Hash over every material input. Cache lookups match on this, never on the
  -- domain alone.
  input_hash         text not null,
  -- Denormalised for listing pages, so the dashboard need not open the jsonb.
  subject_name       text not null,
  subject_domain     text,

  status             text not null default 'queued',
  stage              text not null default 'validating',
  stage_index        integer not null default 0,
  error_code         text,

  result             jsonb,
  schema_version     integer,

  -- Set when this job was served from another job's result instead of running.
  cached_from_job_id uuid references public.research_jobs(id) on delete set null,

  created_at         timestamptz not null default now(),
  started_at         timestamptz,
  completed_at       timestamptz,

  constraint research_jobs_status_known check (
    status in ('queued','researching','analysing','validating','complete','failed','cancelled')
  ),
  constraint research_jobs_public_id_shape check (public_id ~ '^[A-Za-z0-9_-]{12,32}$'),
  constraint research_jobs_token_cost_non_negative check (token_cost >= 0),
  constraint research_jobs_stage_index_range check (stage_index between 0 and 32)
);

create index if not exists research_jobs_user_created_idx
  on public.research_jobs (user_id, created_at desc);

-- Serves the cache lookup: same user, same inputs, recent, and useful.
create index if not exists research_jobs_cache_lookup_idx
  on public.research_jobs (user_id, input_hash, created_at desc)
  where status = 'complete';


-- ── Token ledger ──────────────────────────────────────────────────────────
--
-- Append-only. Every balance change in the system has a row here, and the row
-- is written in the same transaction as the balance change, so the two cannot
-- disagree.
--
-- The sign convention is worth stating precisely, because "amount" in a ledger
-- with reservations is ambiguous:
--
--   amount        signed change to available_balance
--   balance_after available_balance immediately after this row
--
-- Under that convention:
--
--   reservation    amount = -cost   available -= cost, reserved += cost
--   debit          amount =  0      reserved  -= cost   (the hold becomes a spend)
--   refund         amount = +cost   reserved  -= cost, available += cost
--   grant/purchase amount = +n      available += n
--
-- A debit therefore records no change to spendable balance, which is correct:
-- the tokens stopped being spendable at reservation. The row exists so history
-- shows the outcome of the hold rather than leaving it dangling.
create table if not exists public.token_ledger (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  research_job_id  uuid references public.research_jobs(id) on delete set null,

  transaction_type text not null,
  amount           integer not null,
  balance_after    integer not null,

  -- Makes every mutation replayable exactly once. Unique per user, so one
  -- user's key cannot collide with another's.
  idempotency_key  text not null,

  description      text not null,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),

  constraint token_ledger_type_known check (
    transaction_type in (
      'admin_grant','welcome_credit','reservation','debit','refund','purchase','adjustment'
    )
  ),
  constraint token_ledger_balance_after_non_negative check (balance_after >= 0),
  constraint token_ledger_idempotency_key_len check (
    char_length(idempotency_key) between 8 and 200
  )
);

create unique index if not exists token_ledger_user_idempotency_idx
  on public.token_ledger (user_id, idempotency_key);

create index if not exists token_ledger_user_created_idx
  on public.token_ledger (user_id, created_at desc);

create index if not exists token_ledger_job_idx
  on public.token_ledger (research_job_id)
  where research_job_id is not null;


-- ── Append-only enforcement ───────────────────────────────────────────────
--
-- Revoking UPDATE and DELETE from the application role is necessary but not
-- sufficient: the SECURITY DEFINER functions below run as the table owner and
-- would sail straight past a grant. A trigger applies to everyone.
create or replace function public.rs_reject_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'token_ledger is append-only; % is not permitted', tg_op
    using errcode = 'RS004';
end;
$$;

drop trigger if exists token_ledger_no_update on public.token_ledger;
create trigger token_ledger_no_update
  before update on public.token_ledger
  for each row execute function public.rs_reject_ledger_mutation();

drop trigger if exists token_ledger_no_delete on public.token_ledger;
create trigger token_ledger_no_delete
  before delete on public.token_ledger
  for each row execute function public.rs_reject_ledger_mutation();


-- ── Research sources ──────────────────────────────────────────────────────
--
-- The registry behind every citation. position is the number in the S1, S2, S3
-- labels the model is given and the report renders, so it must be stable for
-- the life of the job — a citation that renumbers is a citation that lies.
create table if not exists public.research_sources (
  id               bigserial primary key,
  job_id           uuid not null references public.research_jobs(id) on delete cascade,

  position         integer not null,
  canonical_url    text not null,
  title            text,
  source_type      text not null default 'web_page',
  publisher_domain text,

  retrieved_at     timestamptz not null default now(),
  http_status      integer,
  content_hash     text,
  -- A short relevant extract, never the whole page. Bounded by CHECK as well as
  -- by the extractor, because a limit enforced in one place is a limit that
  -- moves when someone edits that place.
  excerpt          text,

  constraint research_sources_type_known check (
    source_type in ('web_page','search_result','sitemap','robots','directory','review_site','social_profile')
  ),
  constraint research_sources_position_positive check (position >= 1),
  constraint research_sources_excerpt_len check (
    excerpt is null or char_length(excerpt) <= 4000
  )
);

create unique index if not exists research_sources_job_position_idx
  on public.research_sources (job_id, position);

create unique index if not exists research_sources_job_url_idx
  on public.research_sources (job_id, canonical_url);


-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Enabled with zero policies on every table, which in Postgres means deny-all
-- to any role that does not bypass RLS. service_role does bypass it; anon and
-- authenticated do not, and neither holds a grant on these tables anyway
-- (below). The browser never reaches the Data API — it talks to Supabase Auth
-- for sign-in and to this application's own routes for everything else.
--
-- This is the same posture 0001 and 0002 established, and it is deliberate: a
-- policy is a second place where "who may read this" is decided, and the answer
-- here is "nobody, directly".
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.user_profiles    enable row level security;
alter table public.token_wallets    enable row level security;
alter table public.token_ledger     enable row level security;
alter table public.research_jobs    enable row level security;
alter table public.research_sources enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- Grants
--
-- anon and authenticated get nothing. service_role gets the narrowest set that
-- the server code actually uses — and specifically NOT update on token_wallets,
-- which is what makes the read-decide-write race unrepresentable rather than
-- merely discouraged.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on public.user_profiles    from anon, authenticated, public;
revoke all on public.token_wallets    from anon, authenticated, public;
revoke all on public.token_ledger     from anon, authenticated, public;
revoke all on public.research_jobs    from anon, authenticated, public;
revoke all on public.research_sources from anon, authenticated, public;

revoke all on sequence public.research_sources_id_seq from anon, authenticated, public;

-- user_profiles: read on the account page, written at bootstrap and on rename.
revoke all on public.user_profiles from service_role;
grant select, insert, update on public.user_profiles to service_role;

-- token_wallets: SELECT only. Every write goes through the locking functions
-- below, which run as owner. Without an UPDATE grant, application code cannot
-- move a balance even by accident.
revoke all on public.token_wallets from service_role;
grant select on public.token_wallets to service_role;

-- token_ledger: SELECT for the wallet history page. INSERT is not granted —
-- rows are written only by the functions below, so nothing can record a
-- transaction that did not also move a balance.
revoke all on public.token_ledger from service_role;
grant select on public.token_ledger to service_role;

-- research_jobs: created, advanced through stages, completed or failed.
-- No DELETE: a job is history, and history is not something request-handling
-- code should be able to erase.
revoke all on public.research_jobs from service_role;
grant select, insert, update on public.research_jobs to service_role;

-- research_sources: written during the crawl, read when rendering citations.
revoke all on public.research_sources from service_role;
grant select, insert on public.research_sources to service_role;
grant usage on sequence public.research_sources_id_seq to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- Atomic token operations
--
-- Every function here:
--   · is SECURITY DEFINER, so it can write tables the caller cannot;
--   · pins search_path, so a caller cannot shadow a name it resolves;
--   · takes SELECT ... FOR UPDATE on the wallet row before deciding anything;
--   · is idempotent through (user_id, idempotency_key), returning the original
--     outcome on replay rather than applying the change twice.
--
-- Custom SQLSTATEs, surfaced to the application as error.code:
--   RS001  insufficient tokens
--   RS002  no matching reservation to finalise or refund
--   RS003  invalid amount
--   RS004  attempted ledger mutation
-- ═══════════════════════════════════════════════════════════════════════════


-- Creates the profile and wallet if absent, and applies a one-time welcome
-- credit. Safe to call on every authenticated request: the insert is a no-op
-- once the row exists, and the credit is guarded by its own idempotency key.
create or replace function public.rs_bootstrap_account(
  p_user_id         uuid,
  p_display_name    text default null,
  p_welcome_tokens  integer default 0,
  p_idempotency_key text default null
)
returns table (available_balance integer, reserved_balance integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet   public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
begin
  insert into public.user_profiles (user_id, display_name)
  values (p_user_id, p_display_name)
  on conflict (user_id) do nothing;

  insert into public.token_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.token_wallets
  where user_id = p_user_id
  for update;

  if p_welcome_tokens > 0 and p_idempotency_key is not null then
    select * into v_existing
    from public.token_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;

    if not found then
      update public.token_wallets
      set available_balance = available_balance + p_welcome_tokens,
          updated_at = now()
      where user_id = p_user_id
      returning * into v_wallet;

      insert into public.token_ledger (
        user_id, transaction_type, amount, balance_after,
        idempotency_key, description
      ) values (
        p_user_id, 'welcome_credit', p_welcome_tokens, v_wallet.available_balance,
        p_idempotency_key, 'Welcome credit'
      );
    end if;
  end if;

  return query select v_wallet.available_balance, v_wallet.reserved_balance;
end;
$$;


-- Moves tokens from available to reserved for a job that has just been
-- accepted. Refuses rather than overdrawing, and replays safely: a double-click
-- reusing the same key gets the first reservation back, not a second charge.
create or replace function public.rs_reserve_tokens(
  p_user_id         uuid,
  p_job_id          uuid,
  p_amount          integer,
  p_idempotency_key text,
  p_description     text,
  p_metadata        jsonb default '{}'::jsonb
)
returns table (
  ledger_id         uuid,
  available_balance integer,
  reserved_balance  integer,
  replayed          boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet   public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
  v_ledger   public.token_ledger%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Reservation amount must be positive, got %', p_amount
      using errcode = 'RS003';
  end if;

  -- The lock is taken before the idempotency check, not after: two concurrent
  -- replays of the same key must serialise, or both could see "not found".
  select * into v_wallet
  from public.token_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'No wallet for user %', p_user_id using errcode = 'RS001';
  end if;

  select * into v_existing
  from public.token_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    return query
      select v_existing.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  if v_wallet.available_balance < p_amount then
    raise exception 'Insufficient tokens: have %, need %',
      v_wallet.available_balance, p_amount
      using errcode = 'RS001';
  end if;

  update public.token_wallets
  set available_balance = available_balance - p_amount,
      reserved_balance  = reserved_balance  + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.token_ledger (
    user_id, research_job_id, transaction_type, amount, balance_after,
    idempotency_key, description, metadata
  ) values (
    p_user_id, p_job_id, 'reservation', -p_amount, v_wallet.available_balance,
    p_idempotency_key, p_description, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_ledger;

  return query
    select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;


-- Turns a hold into a spend after the job succeeds. The reserved tokens leave
-- the wallet entirely; available balance is untouched, because it was reduced
-- at reservation.
create or replace function public.rs_finalize_tokens(
  p_user_id         uuid,
  p_job_id          uuid,
  p_idempotency_key text
)
returns table (
  ledger_id         uuid,
  available_balance integer,
  reserved_balance  integer,
  replayed          boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet      public.token_wallets%rowtype;
  v_existing    public.token_ledger%rowtype;
  v_reservation public.token_ledger%rowtype;
  v_ledger      public.token_ledger%rowtype;
begin
  select * into v_wallet
  from public.token_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'No wallet for user %', p_user_id using errcode = 'RS001';
  end if;

  select * into v_existing
  from public.token_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    return query
      select v_existing.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  -- The reservation is the authority on the amount. Taking it from a parameter
  -- would let a caller finalise a different figure from the one it reserved.
  select * into v_reservation
  from public.token_ledger
  where user_id = p_user_id
    and research_job_id = p_job_id
    and transaction_type = 'reservation'
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No reservation for job % to finalise', p_job_id
      using errcode = 'RS002';
  end if;

  -- Already settled one way or the other; nothing left to finalise.
  if exists (
    select 1 from public.token_ledger
    where user_id = p_user_id
      and research_job_id = p_job_id
      and transaction_type in ('debit','refund')
  ) then
    return query
      select v_reservation.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  update public.token_wallets
  set reserved_balance = reserved_balance - abs(v_reservation.amount),
      updated_at = now()
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.token_ledger (
    user_id, research_job_id, transaction_type, amount, balance_after,
    idempotency_key, description, metadata
  ) values (
    p_user_id, p_job_id, 'debit', 0, v_wallet.available_balance,
    p_idempotency_key, 'Research completed',
    jsonb_build_object('tokens_spent', abs(v_reservation.amount))
  )
  returning * into v_ledger;

  return query
    select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;


-- Returns a hold to the spendable balance after a system failure. Idempotent in
-- two independent ways: by key, and by refusing to refund a job that has
-- already been settled. Either alone would be enough; both together mean a
-- retry storm cannot mint tokens.
create or replace function public.rs_refund_tokens(
  p_user_id         uuid,
  p_job_id          uuid,
  p_idempotency_key text,
  p_reason          text default 'System failure'
)
returns table (
  ledger_id         uuid,
  available_balance integer,
  reserved_balance  integer,
  replayed          boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet      public.token_wallets%rowtype;
  v_existing    public.token_ledger%rowtype;
  v_reservation public.token_ledger%rowtype;
  v_ledger      public.token_ledger%rowtype;
  v_amount      integer;
begin
  select * into v_wallet
  from public.token_wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'No wallet for user %', p_user_id using errcode = 'RS001';
  end if;

  select * into v_existing
  from public.token_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    return query
      select v_existing.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  select * into v_reservation
  from public.token_ledger
  where user_id = p_user_id
    and research_job_id = p_job_id
    and transaction_type = 'reservation'
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'No reservation for job % to refund', p_job_id
      using errcode = 'RS002';
  end if;

  if exists (
    select 1 from public.token_ledger
    where user_id = p_user_id
      and research_job_id = p_job_id
      and transaction_type in ('debit','refund')
  ) then
    return query
      select v_reservation.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  v_amount := abs(v_reservation.amount);

  update public.token_wallets
  set reserved_balance  = reserved_balance  - v_amount,
      available_balance = available_balance + v_amount,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.token_ledger (
    user_id, research_job_id, transaction_type, amount, balance_after,
    idempotency_key, description, metadata
  ) values (
    p_user_id, p_job_id, 'refund', v_amount, v_wallet.available_balance,
    p_idempotency_key, p_reason, jsonb_build_object('tokens_refunded', v_amount)
  )
  returning * into v_ledger;

  return query
    select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;


-- Adds tokens outside a purchase: an operator grant during testing, or the
-- future purchase path once a payment provider exists.
--
-- This function is the one that can create value from nothing, so note what
-- guards it: EXECUTE is granted only to service_role (below), and no HTTP route
-- calls it without a separate operator secret — see lib/tokens/admin-grant.ts.
-- Its reachability is an application concern; its atomicity is this function's.
create or replace function public.rs_grant_tokens(
  p_user_id          uuid,
  p_amount           integer,
  p_transaction_type text,
  p_idempotency_key  text,
  p_description      text,
  p_metadata         jsonb default '{}'::jsonb
)
returns table (
  ledger_id         uuid,
  available_balance integer,
  reserved_balance  integer,
  replayed          boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_wallet   public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
  v_ledger   public.token_ledger%rowtype;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'Grant amount must be non-zero' using errcode = 'RS003';
  end if;

  if p_transaction_type not in ('admin_grant','welcome_credit','purchase','adjustment') then
    raise exception 'Grant type % is not a crediting type', p_transaction_type
      using errcode = 'RS003';
  end if;

  -- Only 'adjustment' may be negative; the others describe adding value, and a
  -- negative "purchase" would be a refund by another name with none of the
  -- reservation bookkeeping.
  if p_amount < 0 and p_transaction_type <> 'adjustment' then
    raise exception 'Only an adjustment may be negative' using errcode = 'RS003';
  end if;

  insert into public.token_wallets (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet
  from public.token_wallets
  where user_id = p_user_id
  for update;

  select * into v_existing
  from public.token_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key;

  if found then
    return query
      select v_existing.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  if v_wallet.available_balance + p_amount < 0 then
    raise exception 'Adjustment would overdraw: have %, change %',
      v_wallet.available_balance, p_amount
      using errcode = 'RS001';
  end if;

  update public.token_wallets
  set available_balance = available_balance + p_amount,
      updated_at = now()
  where user_id = p_user_id
  returning * into v_wallet;

  insert into public.token_ledger (
    user_id, transaction_type, amount, balance_after,
    idempotency_key, description, metadata
  ) values (
    p_user_id, p_transaction_type, p_amount, v_wallet.available_balance,
    p_idempotency_key, p_description, coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_ledger;

  return query
    select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;


-- ── Function grants ───────────────────────────────────────────────────────
--
-- PUBLIC gets EXECUTE on new functions by default, which for a SECURITY DEFINER
-- function that mints tokens would be a hole rather than a convenience. Revoke
-- first, then grant to the one role the server actually runs as.
revoke all on function public.rs_bootstrap_account(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.rs_reserve_tokens(uuid, uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.rs_finalize_tokens(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rs_refund_tokens(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.rs_grant_tokens(uuid, integer, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.rs_reject_ledger_mutation() from public, anon, authenticated;

grant execute on function public.rs_bootstrap_account(uuid, text, integer, text) to service_role;
grant execute on function public.rs_reserve_tokens(uuid, uuid, integer, text, text, jsonb) to service_role;
grant execute on function public.rs_finalize_tokens(uuid, uuid, text) to service_role;
grant execute on function public.rs_refund_tokens(uuid, uuid, text, text) to service_role;
grant execute on function public.rs_grant_tokens(uuid, integer, text, text, text, jsonb) to service_role;


-- ── updated_at maintenance ────────────────────────────────────────────────
create or replace function public.rs_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists user_profiles_touch_updated_at on public.user_profiles;
create trigger user_profiles_touch_updated_at
  before update on public.user_profiles
  for each row execute function public.rs_touch_updated_at();

revoke all on function public.rs_touch_updated_at() from public, anon, authenticated;
