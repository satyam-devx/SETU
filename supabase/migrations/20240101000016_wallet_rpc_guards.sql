-- ═══════════════════════════════════════════════════════════════
-- Migration 016: Wallet RPC Ownership Guards (newly discovered, not
-- in the original audit — found while verifying that the CRITICAL-1
-- payment fix actually works against the real deployed schema).
--
-- CRITICAL-NEW-1 — pay_from_wallet had no ownership check
--   pay_from_wallet(p_user_id, p_amount, p_order_id) takes
--   p_user_id as a plain parameter and debits THAT wallet, with no
--   check that the caller is p_user_id (or an admin/service_role).
--   src/lib/api.js's PaymentAPI.walletPay() always calls it with
--   the current user's own ID — but nothing stops a malicious
--   authenticated user from calling
--     supabase.rpc('pay_from_wallet', { p_user_id: '<victim-uuid>', p_amount: 99999 })
--   directly and draining ANY other user's wallet balance, by ID
--   guessing or harvesting UUIDs from any other leaky endpoint.
--   This requires no special privilege — any logged-in customer
--   can do it today.
--
-- CRITICAL-NEW-2 — topup_wallet had no caller restriction at all
--   topup_wallet(p_user_id, p_amount, p_reference) unconditionally
--   credits p_user_id's wallet. It is meant to be called ONLY by
--   razorpay-webhook after a real Razorpay payment is captured —
--   but Postgres grants EXECUTE to PUBLIC by default on function
--   creation, and nothing in the migrations revoked it. Any
--   authenticated user can currently call
--     supabase.rpc('topup_wallet', { p_user_id: auth.uid(), p_amount: 999999 })
--   and mint themselves unlimited wallet balance for free, with
--   zero payment ever happening.
--
-- Fix:
--   1. pay_from_wallet — add an ownership check: the caller must
--      either BE p_user_id, OR be calling with no JWT context at
--      all (auth.uid() is null), which is true for the
--      service_role key used by trusted backend flows. A regular
--      user's authenticated session always has a non-null
--      auth.uid(), so this closes the impersonation path without
--      touching the legitimate self-checkout flow.
--   2. topup_wallet — revoke execute from authenticated/anon
--      entirely. It has no legitimate frontend caller (confirmed:
--      not referenced anywhere in src/) — only razorpay-webhook
--      (service_role) should ever call it.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. pay_from_wallet: enforce ownership ───────────────────
create or replace function pay_from_wallet(
  p_user_id  uuid,
  p_amount   numeric,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id   uuid;
  v_new_balance numeric;
begin
  -- CRITICAL-NEW-1 FIX: a logged-in user may only debit their OWN
  -- wallet. auth.uid() is null for service_role/backend callers,
  -- which remain unrestricted (e.g. an internal refund-reversal flow).
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'Unauthorized: cannot debit another user''s wallet';
  end if;

  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- One atomic statement: deduct only if balance is sufficient.
  update wallets
  set    balance    = balance - p_amount,
         updated_at = now()
  where  user_id = p_user_id
    and  balance  >= p_amount
  returning id, balance into v_wallet_id, v_new_balance;

  if not found then
    if exists (select 1 from wallets where user_id = p_user_id) then
      return jsonb_build_object(
        'success',            false,
        'insufficient_funds', true,
        'balance',            (select balance from wallets where user_id = p_user_id)
      );
    else
      return jsonb_build_object('success', false, 'error', 'Wallet not found');
    end if;
  end if;

  insert into wallet_transactions (
    wallet_id, user_id, type, amount, description, reference, status
  ) values (
    v_wallet_id, p_user_id, 'debit', p_amount,
    'Order payment from wallet', p_order_id::text, 'completed'
  );

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- ── 2. topup_wallet: restrict to service_role only ──────────
-- Wrapped in DO block: if topup_wallet was created with a different
-- signature on an older remote, the REVOKE is skipped rather than failing.
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'topup_wallet'
  ) then
    revoke execute on function topup_wallet(uuid, numeric, text) from authenticated, anon;
  end if;
exception when undefined_function then
  null; -- function exists but signature differs; skip
end;
$$;

-- ── 3. upsert_platform_config(_bulk): missing admin check ───
--
-- CRITICAL-NEW-3 — these are `security definer` functions, which
-- run as the function owner and therefore BYPASS the
-- "config_admin_write" RLS policy on platform_config entirely.
-- Despite that policy existing (and looking like the security
-- boundary), neither function checked the caller's role itself —
-- so any authenticated user could call
--   supabase.rpc('upsert_platform_config', { p_key: 'platform_fee_pct', p_value: '0' })
-- and rewrite ANY platform-wide setting (fees, feature flags,
-- whatever else lives in platform_config), same pattern as the
-- already-correctly-guarded admin_update_order_status().
create or replace function upsert_platform_config(
  p_key         text,
  p_value       text,
  p_description text default null
)
returns void as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin role required';
  end if;

  insert into platform_config (key, value, description, updated_by, updated_at)
  values (p_key, p_value, coalesce(p_description, ''), auth.uid(), now())
  on conflict (key) do update
    set value      = excluded.value,
        updated_by = auth.uid(),
        updated_at = now();
end;
$$ language plpgsql security definer;

create or replace function upsert_platform_config_bulk(
  p_entries jsonb
)
returns void as $$
declare
  entry jsonb;
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin role required';
  end if;

  for entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into platform_config (key, value, updated_by, updated_at)
    values (entry->>'key', entry->>'value', auth.uid(), now())
    on conflict (key) do update
      set value      = excluded.value,
          updated_by = auth.uid(),
          updated_at = now();
  end loop;
end;
$$ language plpgsql security definer;

-- ── 4. place_order: unused, dangerous dead code ─────────────
--
-- CRITICAL-NEW-4 — confirmed via grep that NOTHING in src/ or qa/
-- calls supabase.rpc('place_order', ...) — the real checkout flow
-- (src/lib/api.js placeOrder()) does a direct table insert with
-- payment_status always 'pending', which is correct. But this SQL
-- function still exists and is still callable, and it is far more
-- dangerous than the real flow: it (a) takes p_customer_id as a
-- plain parameter with no auth.uid() check, and (b) sets
-- `payment_status = 'paid'` IMMEDIATELY for any non-COD payment
-- method, with no payment having actually been captured. Anyone
-- could call it directly and receive a fully "paid" order for
-- free. Since nothing legitimate depends on it, revoke it outright
-- rather than risk a partial fix on code nothing exercises.
do $$
begin
  revoke execute on function place_order(
    uuid, text, uuid, text, text, text, text, numeric, numeric, numeric, numeric, jsonb, text, boolean
  ) from authenticated, anon;
exception when undefined_function then
  null; -- function may not exist or signature may differ; skip
end;
$$;

-- ── 5. review_image: missing admin check ────────────────────
--
-- CRITICAL-NEW-5 — any authenticated user could call
--   supabase.rpc('review_image', { p_image_id: '<any-id>', p_status: 'approved' })
-- and approve/reject ANY pending image moderation entry (vendor shop
-- photos, etc.), bypassing the moderation queue entirely.
create or replace function review_image(
  p_image_id uuid,
  p_status   text,
  p_reason   text default null
)
returns void as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin role required';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;

  update image_moderation
    set status        = p_status,
        reviewed_by   = auth.uid(),
        reviewed_at   = now(),
        reject_reason = p_reason
  where id = p_image_id;
end;
$$ language plpgsql security definer;

-- ── 6. set_default_address: missing ownership check ─────────
--
-- CRITICAL-NEW-6 — set_default_address(p_user_id, p_address_id)
-- took p_user_id as a plain parameter with no auth.uid() check, so
-- any authenticated user could change which address is "default"
-- for ANY other user's account. Low financial impact but a real
-- unauthorized-write bug.
create or replace function set_default_address(
  p_user_id    uuid,
  p_address_id uuid
)
returns jsonb
language plpgsql
security definer
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

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'review_image,set_default_address',
  'migration_016 (cont.): added is_admin() check to review_image (was callable by any user to approve/reject any image moderation entry); added ownership check to set_default_address (was callable on any other user''s addresses)'
);
