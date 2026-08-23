-- ═══════════════════════════════════════════════════════════════════════════
-- Let account deletion cascade through the ledger
--
-- Applied remotely as `allow_ledger_removal_on_account_deletion`.
--
-- The append-only trigger from 0004 was absolute, which made auth.users rows
-- undeletable: deleting an account cascades into token_ledger, the trigger
-- refused the cascade, and the whole delete failed with RS004. An account that
-- cannot be deleted is a privacy problem, not a safety feature. This surfaced
-- when a self-test tried to clean up after itself.
--
-- The fix leans on Postgres's ordering. Referential-integrity actions are AFTER
-- ROW triggers, so by the time a cascade reaches token_ledger the parent
-- auth.users row is already gone inside the transaction. "Does the owning user
-- still exist?" therefore separates the two cases exactly:
--
--   user still exists  →  someone is editing history       →  refuse
--   user already gone  →  this is the account being deleted →  permit
--
-- A direct `delete from public.token_ledger where user_id = ...` still fails,
-- because that user is very much still there. The only route to removing a
-- ledger row is removing the person it belongs to.
--
-- UPDATE is covered by the same predicate, because deleting an account also
-- cascades `on delete set null` onto token_ledger.research_job_id — an UPDATE,
-- which would otherwise fail depending on the order the cascades happen to run.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rs_reject_ledger_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from auth.users u where u.id = old.user_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception 'token_ledger is append-only; % is not permitted', tg_op
    using errcode = 'RS004',
          hint = 'Ledger rows are removed only by deleting the owning account.';
end;
$$;

revoke all on function public.rs_reject_ledger_mutation() from public, anon, authenticated;
