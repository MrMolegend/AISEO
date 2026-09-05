-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: explainable account scores
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0020. Apply as `account_scores`.
--
-- One current score per account, replaced on recompute. The components
-- column holds the full working — every dimension's raw signal, weight,
-- weighted contribution, one-sentence explanation, and whether the input
-- was missing — because a score nobody can decompose is a vibe with a
-- number on it.
--
-- Overrides never destroy the computed value: the computed total stays in
-- `total`, the human's number sits beside it with who and why, and the
-- audit trail keeps the change. Clearing an override restores nothing
-- because nothing was lost.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.account_scores (
  account_id     uuid primary key references public.lead_accounts(id) on delete cascade,

  total          integer not null,
  components     jsonb not null default '[]',
  weights_used   jsonb not null default '{}',
  computed_at    timestamptz not null default now(),

  override_total integer,
  override_reason text,
  overridden_by  uuid references auth.users(id) on delete set null,
  overridden_at  timestamptz,

  constraint account_scores_total check (total between 0 and 100),
  constraint account_scores_override check (
    override_total is null or override_total between 0 and 100
  ),
  constraint account_scores_reason check (
    override_reason is null or char_length(override_reason) <= 500
  ),
  -- An override without a reason is not an override, it is a mystery.
  constraint account_scores_override_pair check (
    (override_total is null) = (override_reason is null)
  )
);

alter table public.account_scores enable row level security;
revoke all on public.account_scores from anon, authenticated, public;
revoke all on public.account_scores from service_role;
grant select, insert, update on public.account_scores to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop table if exists public.account_scores;
-- ═══════════════════════════════════════════════════════════════════════════
