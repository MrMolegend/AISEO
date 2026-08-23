-- ═══════════════════════════════════════════════════════════════════════════
-- Correct the token functions' output names
--
-- Applied remotely as migration `fix_token_function_output_names`.
--
-- 0004 declared RETURNS TABLE columns called available_balance and
-- reserved_balance. Those are also column names on token_wallets, and inside a
-- plpgsql body an output name is a variable, so `set available_balance =
-- available_balance + n` is ambiguous. Postgres accepts the function at
-- creation and refuses it at run time with 42702 — which means every
-- balance-moving function was broken and nothing said so until one was called.
--
-- Renaming the outputs with an out_ prefix removes the collision at its source.
-- Qualifying each reference would have worked too, but would have left the same
-- trap for the next function someone writes. The UPDATE statements also take a
-- table alias so the column side of each assignment is unambiguous regardless
-- of what the outputs are called.
--
-- A return-type change cannot use CREATE OR REPLACE, hence the drops.
--
-- Note: rs_finalize_tokens and rs_refund_tokens are superseded again by 0007
-- and 0008. Both are kept as applied rather than folded together, because these
-- migrations have run against the live database and rewriting an applied
-- migration is how a schema and its recorded history quietly diverge.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.rs_bootstrap_account(uuid, text, integer, text);
drop function if exists public.rs_reserve_tokens(uuid, uuid, integer, text, text, jsonb);
drop function if exists public.rs_finalize_tokens(uuid, uuid, text);
drop function if exists public.rs_refund_tokens(uuid, uuid, text, text);
drop function if exists public.rs_grant_tokens(uuid, integer, text, text, text, jsonb);

create function public.rs_bootstrap_account(
  p_user_id uuid, p_display_name text default null,
  p_welcome_tokens integer default 0, p_idempotency_key text default null
) returns table (out_available integer, out_reserved integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_wallet public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
begin
  insert into public.user_profiles (user_id, display_name)
  values (p_user_id, p_display_name) on conflict (user_id) do nothing;

  insert into public.token_wallets (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet from public.token_wallets where user_id = p_user_id for update;

  if p_welcome_tokens > 0 and p_idempotency_key is not null then
    select * into v_existing from public.token_ledger
    where user_id = p_user_id and idempotency_key = p_idempotency_key;

    if not found then
      update public.token_wallets w
      set available_balance = w.available_balance + p_welcome_tokens, updated_at = now()
      where w.user_id = p_user_id returning w.* into v_wallet;

      insert into public.token_ledger (
        user_id, transaction_type, amount, balance_after, idempotency_key, description
      ) values (
        p_user_id, 'welcome_credit', p_welcome_tokens, v_wallet.available_balance,
        p_idempotency_key, 'Welcome credit'
      );
    end if;
  end if;

  return query select v_wallet.available_balance, v_wallet.reserved_balance;
end;
$$;

create function public.rs_reserve_tokens(
  p_user_id uuid, p_job_id uuid, p_amount integer,
  p_idempotency_key text, p_description text, p_metadata jsonb default '{}'::jsonb
) returns table (out_ledger_id uuid, out_available integer, out_reserved integer, out_replayed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_wallet public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
  v_ledger public.token_ledger%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Reservation amount must be positive, got %', p_amount using errcode = 'RS003';
  end if;

  -- The lock precedes the idempotency check, not the other way round: two
  -- concurrent replays of the same key must serialise here, or both could see
  -- "not found" and both reserve.
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

  if v_wallet.available_balance < p_amount then
    raise exception 'Insufficient tokens: have %, need %', v_wallet.available_balance, p_amount
      using errcode = 'RS001';
  end if;

  update public.token_wallets w
  set available_balance = w.available_balance - p_amount,
      reserved_balance  = w.reserved_balance  + p_amount,
      updated_at = now()
  where w.user_id = p_user_id returning w.* into v_wallet;

  insert into public.token_ledger (
    user_id, research_job_id, transaction_type, amount, balance_after,
    idempotency_key, description, metadata
  ) values (
    p_user_id, p_job_id, 'reservation', -p_amount, v_wallet.available_balance,
    p_idempotency_key, p_description, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_ledger;

  return query select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;

create function public.rs_finalize_tokens(
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

  select * into v_reservation from public.token_ledger
  where user_id = p_user_id and research_job_id = p_job_id and transaction_type = 'reservation'
  order by created_at desc limit 1;
  if not found then
    raise exception 'No reservation for job % to finalise', p_job_id using errcode = 'RS002';
  end if;

  if exists (
    select 1 from public.token_ledger
    where user_id = p_user_id and research_job_id = p_job_id
      and transaction_type in ('debit','refund')
  ) then
    return query select v_reservation.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
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
    jsonb_build_object('tokens_spent', abs(v_reservation.amount))
  ) returning * into v_ledger;

  return query select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;

create function public.rs_refund_tokens(
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

  select * into v_reservation from public.token_ledger
  where user_id = p_user_id and research_job_id = p_job_id and transaction_type = 'reservation'
  order by created_at desc limit 1;
  if not found then
    raise exception 'No reservation for job % to refund', p_job_id using errcode = 'RS002';
  end if;

  if exists (
    select 1 from public.token_ledger
    where user_id = p_user_id and research_job_id = p_job_id
      and transaction_type in ('debit','refund')
  ) then
    return query select v_reservation.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
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
    p_idempotency_key, p_reason, jsonb_build_object('tokens_refunded', v_amount)
  ) returning * into v_ledger;

  return query select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;

create function public.rs_grant_tokens(
  p_user_id uuid, p_amount integer, p_transaction_type text,
  p_idempotency_key text, p_description text, p_metadata jsonb default '{}'::jsonb
) returns table (out_ledger_id uuid, out_available integer, out_reserved integer, out_replayed boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_wallet public.token_wallets%rowtype;
  v_existing public.token_ledger%rowtype;
  v_ledger public.token_ledger%rowtype;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'Grant amount must be non-zero' using errcode = 'RS003';
  end if;

  if p_transaction_type not in ('admin_grant','welcome_credit','purchase','adjustment') then
    raise exception 'Grant type % is not a crediting type', p_transaction_type using errcode = 'RS003';
  end if;

  -- Only an adjustment may be negative. A negative "purchase" would be a refund
  -- by another name, with none of the reservation bookkeeping that makes a
  -- refund safe to replay.
  if p_amount < 0 and p_transaction_type <> 'adjustment' then
    raise exception 'Only an adjustment may be negative' using errcode = 'RS003';
  end if;

  insert into public.token_wallets (user_id) values (p_user_id)
  on conflict (user_id) do nothing;

  select * into v_wallet from public.token_wallets where user_id = p_user_id for update;

  select * into v_existing from public.token_ledger
  where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    return query select v_existing.id, v_wallet.available_balance, v_wallet.reserved_balance, true;
    return;
  end if;

  if v_wallet.available_balance + p_amount < 0 then
    raise exception 'Adjustment would overdraw: have %, change %',
      v_wallet.available_balance, p_amount using errcode = 'RS001';
  end if;

  update public.token_wallets w
  set available_balance = w.available_balance + p_amount, updated_at = now()
  where w.user_id = p_user_id returning w.* into v_wallet;

  insert into public.token_ledger (
    user_id, transaction_type, amount, balance_after, idempotency_key, description, metadata
  ) values (
    p_user_id, p_transaction_type, p_amount, v_wallet.available_balance,
    p_idempotency_key, p_description, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into v_ledger;

  return query select v_ledger.id, v_wallet.available_balance, v_wallet.reserved_balance, false;
end;
$$;

revoke all on function public.rs_bootstrap_account(uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.rs_reserve_tokens(uuid, uuid, integer, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.rs_finalize_tokens(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.rs_refund_tokens(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.rs_grant_tokens(uuid, integer, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.rs_bootstrap_account(uuid, text, integer, text) to service_role;
grant execute on function public.rs_reserve_tokens(uuid, uuid, integer, text, text, jsonb) to service_role;
grant execute on function public.rs_finalize_tokens(uuid, uuid, text) to service_role;
grant execute on function public.rs_refund_tokens(uuid, uuid, text, text) to service_role;
grant execute on function public.rs_grant_tokens(uuid, integer, text, text, text, jsonb) to service_role;
