-- ═══════════════════════════════════════════════════════════════════════════
-- Settle each reservation, not each job
--
-- Applied remotely as `settle_reservations_individually`.
--
-- rs_finalize_tokens and rs_refund_tokens guarded against double-settlement by
-- asking "does this job already have a debit or refund?". That is the wrong
-- question. A job can carry more than one reservation, and once it had been
-- settled once, every later reservation on it became permanently unsettleable:
-- the hold stayed in reserved_balance forever and no debit row was ever
-- written.
--
-- The pipeline reserves once per job, so this would not have fired today. It
-- would have fired the first time anyone added a retry that reuses a job, and
-- it would have presented as tokens quietly stuck in "reserved" — the kind of
-- bug that gets noticed by a user before it gets noticed by us.
--
-- Settling rows now record the reservation they close in metadata.settles, so
-- the guard can ask the precise question: has *this reservation* been settled?
--
-- Superseded in part by 0008, which replaces the reservation lookup itself.
-- Kept as applied rather than folded in — see the note in 0005.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rs_finalize_tokens(
  p_user_id uuid, p_job_id uuid, p_idempotency_key text
) returns table (out_ledger_id uuid, out_available integer, out_reserved integer, out_replayed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_wallet public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
  v_reservation public.token_ledger%rowtype;
  v_settled public.token_ledger%rowtype;
  v_ledger public.token_ledger%rowtype;
begin
  select * into v_wallet from public.token_wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'No wallet for user %', p_user_id using errcode = 'RS001';
  end if;

  select * into v_existing from public.token_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  select * into v_reservation from public.token_ledger
  where user_id = p_user_id and research_job_id = p_job_id and transaction_type = 'reservation'
  order by created_at desc limit 1;
  if not found then
    raise exception 'No reservation for job % to finalise', p_job_id using errcode = 'RS002';
  end if;

  select * into v_settled from public.token_ledger
  where user_id = p_user_id
    and transaction_type in ('debit','refund')
    and metadata ->> 'settles' = v_reservation.id::text
  limit 1;
  if found then
    return query select v_settled.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  update public.token_wallets w
  set reserved_balance = w.reserved_balance - abs(v_reservation.amount), updated_at = now()
  where w.user_id = p_user_id returning w.* into v_wallet;

  insert into public.token_ledger (
    user_id, research_job_id, transaction_type, amount, balance_after,
    idempotency_key, description, metadata
  ) values (
    p_user_id, p_job_id, 'debit', 0, v_wallet.available_balance,
    p_idempotency_key, 'Research completed',
    jsonb_build_object('tokens_spent', abs(v_reservation.amount),
                       'settles', v_reservation.id::text)
  ) returning * into v_ledger;

  return query select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;

create or replace function public.rs_refund_tokens(
  p_user_id uuid, p_job_id uuid, p_idempotency_key text, p_reason text default 'System failure'
) returns table (out_ledger_id uuid, out_available integer, out_reserved integer, out_replayed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_wallet public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
  v_reservation public.token_ledger%rowtype;
  v_settled public.token_ledger%rowtype;
  v_ledger public.token_ledger%rowtype;
  v_amount integer;
begin
  select * into v_wallet from public.token_wallets where user_id = p_user_id for update;
  if not found then
    raise exception 'No wallet for user %', p_user_id using errcode = 'RS001';
  end if;

  select * into v_existing from public.token_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  select * into v_reservation from public.token_ledger
  where user_id = p_user_id and research_job_id = p_job_id and transaction_type = 'reservation'
  order by created_at desc limit 1;
  if not found then
    raise exception 'No reservation for job % to refund', p_job_id using errcode = 'RS002';
  end if;

  select * into v_settled from public.token_ledger
  where user_id = p_user_id
    and transaction_type in ('debit','refund')
    and metadata ->> 'settles' = v_reservation.id::text
  limit 1;
  if found then
    return query select v_settled.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  v_amount := abs(v_reservation.amount);

  update public.token_wallets w
  set reserved_balance  = w.reserved_balance  - v_amount,
      available_balance = w.available_balance + v_amount,
      updated_at = now()
  where w.user_id = p_user_id returning w.* into v_wallet;

  insert into public.token_ledger (
    user_id, research_job_id, transaction_type, amount, balance_after,
    idempotency_key, description, metadata
  ) values (
    p_user_id, p_job_id, 'refund', v_amount, v_wallet.available_balance,
    p_idempotency_key, p_reason,
    jsonb_build_object('tokens_refunded', v_amount, 'settles', v_reservation.id::text)
  ) returning * into v_ledger;

  return query select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;

-- Makes the settle-once check an index lookup rather than a scan of the user's
-- whole history, which starts to matter once a busy account has thousands of rows.
create index if not exists token_ledger_settles_idx
  on public.token_ledger ((metadata ->> 'settles'))
  where transaction_type in ('debit','refund');

revoke all on function public.rs_finalize_tokens(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rs_refund_tokens(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.rs_finalize_tokens(uuid, uuid, text) to service_role;
grant execute on function public.rs_refund_tokens(uuid, uuid, text, text) to service_role;
