-- ═══════════════════════════════════════════════════════════════════════════
-- Look up the outstanding reservation directly
--
-- Applied remotely as `select_outstanding_reservation_directly`.
--
-- 0007 still picked "the most recent reservation" and then asked whether it had
-- been settled. That is two steps where one will do, and the first step is not
-- deterministic: created_at comes from now(), which is fixed for the whole
-- transaction, so two reservations created in the same transaction tie and the
-- ordering breaks the tie arbitrarily. When it picked an already-settled row,
-- settlement reported "already done" and left a live hold stranded in
-- reserved_balance.
--
-- Ask the real question instead: which reservation on this job has not been
-- settled? There is at most one outstanding at a time, ties stop mattering
-- because settled rows are excluded rather than ranked, and the two failure
-- modes stay distinguishable:
--
--   no reservation rows at all  →  RS002, the caller is confused
--   rows exist but all settled  →  replayed, the caller is retrying
--
-- Both functions share the lookup, so it lives in one place.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.rs_outstanding_reservation(
  p_user_id uuid, p_job_id uuid
) returns public.token_ledger
language sql stable security definer set search_path = public, pg_temp as $$
  select res.*
  from public.token_ledger res
  where res.user_id = p_user_id
    and res.research_job_id = p_job_id
    and res.transaction_type = 'reservation'
    and not exists (
      select 1 from public.token_ledger s
      where s.user_id = p_user_id
        and s.transaction_type in ('debit','refund')
        and s.metadata ->> 'settles' = res.id::text
    )
  order by res.created_at desc
  limit 1;
$$;

create or replace function public.rs_finalize_tokens(
  p_user_id uuid, p_job_id uuid, p_idempotency_key text
) returns table (out_ledger_id uuid, out_available integer, out_reserved integer, out_replayed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_wallet public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
  v_reservation public.token_ledger%rowtype;
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

  v_reservation := public.rs_outstanding_reservation(p_user_id, p_job_id);

  if v_reservation.id is null then
    if exists (
      select 1 from public.token_ledger
      where user_id = p_user_id and research_job_id = p_job_id
        and transaction_type = 'reservation'
    ) then
      -- Every hold on this job is already settled: a retry, not an error.
      return query select null::uuid, v_wallet.available_balance, v_wallet.reserved_balance, true;
      return;
    end if;
    raise exception 'No reservation for job % to finalise', p_job_id using errcode = 'RS002';
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

  v_reservation := public.rs_outstanding_reservation(p_user_id, p_job_id);

  if v_reservation.id is null then
    if exists (
      select 1 from public.token_ledger
      where user_id = p_user_id and research_job_id = p_job_id
        and transaction_type = 'reservation'
    ) then
      return query select null::uuid, v_wallet.available_balance, v_wallet.reserved_balance, true;
      return;
    end if;
    raise exception 'No reservation for job % to refund', p_job_id using errcode = 'RS002';
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

revoke all on function public.rs_outstanding_reservation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rs_finalize_tokens(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rs_refund_tokens(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.rs_finalize_tokens(uuid, uuid, text) to service_role;
grant execute on function public.rs_refund_tokens(uuid, uuid, text, text) to service_role;
