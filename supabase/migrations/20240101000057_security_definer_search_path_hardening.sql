-- ═══════════════════════════════════════════════════════════════
-- Migration 057 (PASS 5 — SEC-04): SECURITY DEFINER functions missing
-- an explicit search_path
--
-- Pass 3/4 identified four functions whose current definitions lack
-- `set search_path`, a defense-in-depth measure against search-path
-- hijacking (relevant specifically to SECURITY DEFINER functions,
-- which run with the function OWNER's privileges regardless of who
-- calls them). No exploit path was demonstrated in any pass — this
-- repository's migrations do not grant CREATE on the public schema to
-- non-privileged roles — but the fix is cheap, mechanical, and
-- zero-risk, so it is applied here per Pass 4's recommendation.
--
-- Each function's logic is reproduced byte-for-byte from its current
-- (latest) definition; only `set search_path = public` is added.
-- Grants, ownership, and behavior are otherwise unchanged.
--
-- topup_wallet and set_default_address were already re-verified (P0/P2
-- work elsewhere this pass touched pay_from_wallet, a DIFFERENT
-- function, in migration 056 — topup_wallet itself was untouched
-- until now).
-- ═══════════════════════════════════════════════════════════════

-- ── 1. topup_wallet — unchanged logic, adds search_path ──────────
create or replace function topup_wallet(
  p_user_id   uuid,
  p_amount    numeric,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id  uuid;
  v_new_balance numeric;
begin
  insert into wallets (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance    = wallets.balance + excluded.balance,
        updated_at = now()
  returning id, balance into v_wallet_id, v_new_balance;

  insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
  values (v_wallet_id, p_user_id, 'credit', p_amount, 'Wallet top-up', p_reference, 'completed');

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- ── 2. set_default_address — unchanged logic, adds search_path ───
create or replace function set_default_address(
  p_user_id    uuid,
  p_address_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Unauthorized: cannot modify another user''s addresses';
  end if;

  update customer_addresses
     set is_default = false
   where user_id = p_user_id
     and is_default = true;

  update customer_addresses
     set is_default = true
   where id = p_address_id
     and user_id = p_user_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ── 3. _set_internal_payment_flag — unchanged logic, adds search_path ──
create or replace function _set_internal_payment_flag()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('setu.internal_payment_update', 'true', true); -- tx-local
end;
$$;

-- ── 4. update_updated_at — unchanged logic, adds search_path ─────
-- (Not SECURITY DEFINER — runs as the invoking role, so this is a
-- lower-risk item than 1-3, but included for consistency since it was
-- flagged in the same Pass 3/4 sweep.)
create or replace function update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'topup_wallet,set_default_address,_set_internal_payment_flag,update_updated_at',
  'migration_057 (PASS 5 SEC-04): added explicit set search_path = public to four functions that were missing it (topup_wallet, set_default_address, _set_internal_payment_flag, update_updated_at). Logic, grants, and ownership unchanged — defense-in-depth hardening only, no behavior change.'
);
