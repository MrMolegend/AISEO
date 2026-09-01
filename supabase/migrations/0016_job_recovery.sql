-- ═══════════════════════════════════════════════════════════════════════════
-- Job recovery metadata
--
-- NOT YET APPLIED to the live project. Applied at deploy time, in order,
-- 0011 → 0016. Apply as `job_recovery`.
--
-- A research job that dies between stages — process recycled mid-run, provider
-- hung past every timeout — leaves a row that says "researching" forever and a
-- reservation that never settles. Nothing in the schema could distinguish
-- "working" from "dead" because nothing recorded a pulse.
--
--   · heartbeat_at is that pulse: the runner touches it at every stage
--     transition. A non-terminal job whose heartbeat is older than the stall
--     threshold is not slow, it is gone.
--   · attempt_count records how many times a run has started for this row, so
--     the repair path and the ops console can tell first-run stalls from
--     jobs that die on every retry.
--
-- Repair itself is application code, not schema: mark the stale job failed
-- with a refundable error code and settle the reservation through the same
-- idempotent rs_refund_tokens path every other failure uses. Exactly-once
-- settlement is the ledger's property, not this migration's.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.research_jobs
  add column if not exists attempt_count integer not null default 1;

alter table public.research_jobs
  add column if not exists heartbeat_at timestamptz;

alter table public.research_jobs
  drop constraint if exists research_jobs_attempts_positive;

alter table public.research_jobs
  add constraint research_jobs_attempts_positive check (attempt_count >= 1);

-- The stall sweep reads exactly this: non-terminal jobs, oldest pulse first.
-- Partial, because terminal rows — almost all rows — can never be stale.
create index if not exists research_jobs_stall_sweep_idx
  on public.research_jobs (heartbeat_at)
  where status not in ('complete', 'failed', 'cancelled');


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
--   drop index if exists public.research_jobs_stall_sweep_idx;
--   alter table public.research_jobs
--     drop constraint if exists research_jobs_attempts_positive;
--   alter table public.research_jobs drop column if exists heartbeat_at;
--   alter table public.research_jobs drop column if exists attempt_count;
-- ═══════════════════════════════════════════════════════════════════════════
