-- ═══════════════════════════════════════════════════════════════
-- Migration 015: Port missing payment RPC functions (deploy-blocking gap)
--
-- DISCOVERED while implementing CRITICAL-1 (payment amount
-- reconciliation): razorpay-webhook and vendor-payout call
-- record_delivery_split(), confirm_vendor_payout(), and
-- initiate_vendor_payout() via supabase.rpc(...) — but these
-- functions only ever existed in database/functions_phase0_payments.sql,
-- a LEGACY tree that the deploy pipeline does NOT push (only
-- supabase/migrations/ is deployed — see audit "dual migration
-- trees" finding). Migration 008 created the vendor_escrow /
-- delivery_fee_splits / vendor_payouts tables and the
-- payment_status guard trigger, but never followed up with the
-- functions that actually populate them.
--
-- Net effect before this migration: on a fresh deploy via the
-- existing CI/CD pipeline, EVERY payment.captured webhook event
-- would fail at the `record_delivery_split` RPC call with
-- "function does not exist" — vendor escrow would never be
-- credited and vendor payouts could never be initiated, even
-- though the webhook signature/amount checks (CRITICAL-1) were
-- passing correctly. This migration is what makes that fix
-- actually work end-to-end, not just look correct in code review.
--
-- Ported as-is from database/functions_phase0_payments.sql, with
-- one change: removed the `_set_internal_payment_flag()` / internal
-- payment-flag dependency, since none of these four functions write
-- to orders.payment_status (only cancel_order_with_refund and
-- update_order_status do, and those already exist/are guarded
-- elsewhere) — service_role callers already pass the guard trigger
-- in migration 008 via the request.jwt.claims role check.
--
-- NOTE: database/functions_phase0_payments.sql also defines
-- cancel_order_with_refund, create_rider_payment_batch, and
-- confirm_rider_payment, which are NOT ported here because nothing
-- in the current Edge Functions calls them yet. Port those too
-- before wiring any admin UI that needs them — see SECURITY_FIXES.md.
-- ═══════════════════════════════════════════════════════════════

-- ── compute_fee_split ─────────────────────────────────────
-- Pure function: given order totals, returns split amounts.
-- Vendor gets: subtotal - platform_cut. Rider earns a fixed base
-- fee + the order's delivery fee.
create or replace function compute_fee_split(
  p_subtotal       numeric,
  p_delivery_fee   numeric,
  p_platform_fee   numeric,
  p_rider_base_fee numeric default 80
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'vendor_amount',  p_subtotal - p_platform_fee,
    'platform_cut',   p_platform_fee,
    'rider_earning',  p_rider_base_fee + p_delivery_fee
  );
$$;

-- ── record_delivery_split ─────────────────────────────────
-- Called by razorpay-webhook on payment.captured (after the
-- CRITICAL-1 amount-reconciliation check has passed). Writes the
-- immutable delivery_fee_splits record and credits vendor_escrow
-- atomically. Idempotent: a retried webhook event is a no-op if
-- the split was already recorded for this order.
create or replace function record_delivery_split(
  p_order_id            uuid,
  p_razorpay_payment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order      orders%rowtype;
  v_split      jsonb;
  v_vendor_amt numeric;
  v_platform   numeric;
  v_rider_earn numeric;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

  -- Idempotency: a Razorpay webhook retry must not double-credit escrow.
  if exists (select 1 from delivery_fee_splits where order_id = p_order_id) then
    return jsonb_build_object('success', true, 'skipped', true);
  end if;

  v_split      := compute_fee_split(v_order.subtotal, v_order.delivery_fee, v_order.platform_fee);
  v_vendor_amt := (v_split->>'vendor_amount')::numeric;
  v_platform   := (v_split->>'platform_cut')::numeric;
  v_rider_earn := (v_split->>'rider_earning')::numeric;

  insert into delivery_fee_splits (
    order_id, order_total, subtotal, delivery_fee, platform_fee,
    vendor_amount, platform_cut, rider_earning,
    payment_method, razorpay_payment_id
  ) values (
    p_order_id, v_order.total, v_order.subtotal, v_order.delivery_fee, v_order.platform_fee,
    v_vendor_amt, v_platform, v_rider_earn,
    v_order.payment_method, p_razorpay_payment_id
  );

  insert into vendor_escrow (vendor_id, balance, total_credited)
  values (v_order.vendor_id, v_vendor_amt, v_vendor_amt)
  on conflict (vendor_id) do update
    set balance        = vendor_escrow.balance + excluded.balance,
        total_credited = vendor_escrow.total_credited + excluded.total_credited,
        updated_at     = now();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    null, 'system', 'fee_split_recorded',
    v_order.order_number,
    format('vendor=₹%s platform=₹%s rider=₹%s', v_vendor_amt, v_platform, v_rider_earn)
  );

  return jsonb_build_object(
    'success',       true,
    'vendor_amount', v_vendor_amt,
    'platform_cut',  v_platform,
    'rider_earning', v_rider_earn
  );
end;
$$;

-- ── initiate_vendor_payout ────────────────────────────────
-- Admin-triggered (via vendor-payout Edge Function, which already
-- checks the caller's admin role before this RPC is ever reached).
-- Reserves funds by debiting escrow immediately, before the actual
-- Razorpay Route payout call — prevents a double-payout race if the
-- admin double-clicks or the Edge Function retries.
create or replace function initiate_vendor_payout(
  p_vendor_id    uuid,
  p_amount       numeric,
  p_method       text default 'razorpay_route',
  p_bank_ref     text default null,
  p_initiated_by uuid default null,
  p_notes        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escrow    vendor_escrow%rowtype;
  v_payout_id uuid;
begin
  select * into v_escrow from vendor_escrow where vendor_id = p_vendor_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Vendor escrow account not found');
  end if;

  if v_escrow.balance < p_amount then
    return jsonb_build_object(
      'success',          false,
      'error',            'Insufficient escrow balance',
      'escrow_balance',   v_escrow.balance,
      'requested_amount', p_amount
    );
  end if;

  update vendor_escrow set
    balance    = balance - p_amount,
    updated_at = now()
  where vendor_id = p_vendor_id;

  insert into vendor_payouts (
    vendor_id, amount, status, payout_method,
    bank_account_ref, initiated_by, initiated_at, notes
  ) values (
    p_vendor_id, p_amount, 'processing', p_method,
    p_bank_ref, p_initiated_by, now(), p_notes
  )
  returning id into v_payout_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    p_initiated_by,
    coalesce((select name from profiles where id = p_initiated_by), 'admin'),
    'vendor_payout_initiated',
    p_vendor_id::text,
    format('Amount: ₹%s via %s', p_amount, p_method)
  );

  return jsonb_build_object('success', true, 'payout_id', v_payout_id, 'amount', p_amount);
end;
$$;

-- ── confirm_vendor_payout ─────────────────────────────────
-- Called by razorpay-webhook (payout.processed / payout.failed /
-- payout.reversed) or directly by the vendor-payout Edge Function
-- if the initial Razorpay payout creation call itself fails.
-- p_status: 'paid' | 'failed'
create or replace function confirm_vendor_payout(
  p_payout_id          uuid,
  p_status             text,
  p_razorpay_payout_id text default null,
  p_failure_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payout vendor_payouts%rowtype;
begin
  select * into v_payout from vendor_payouts where id = p_payout_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Payout not found');
  end if;

  if v_payout.status not in ('pending', 'processing') then
    -- Idempotency: a retried webhook for an already-finalised payout is a no-op.
    return jsonb_build_object('success', true, 'skipped', true, 'status', v_payout.status);
  end if;

  update vendor_payouts set
    status             = p_status,
    razorpay_payout_id = coalesce(p_razorpay_payout_id, razorpay_payout_id),
    failure_reason     = p_failure_reason,
    paid_at            = case when p_status = 'paid' then now() else null end,
    updated_at         = now()
  where id = p_payout_id;

  if p_status = 'failed' then
    -- Return reserved funds to escrow.
    update vendor_escrow set
      balance    = balance + v_payout.amount,
      updated_at = now()
    where vendor_id = v_payout.vendor_id;
  else
    update vendor_escrow set
      total_paid_out = total_paid_out + v_payout.amount,
      updated_at      = now()
    where vendor_id = v_payout.vendor_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    null, 'system',
    'vendor_payout_' || p_status,
    v_payout.vendor_id::text,
    format('Payout %s: ₹%s %s', p_payout_id, v_payout.amount, coalesce(p_failure_reason, ''))
  );

  return jsonb_build_object('success', true, 'payout_id', p_payout_id, 'status', p_status);
end;
$$;

-- SECURITY: these are security-definer functions that move real
-- money (escrow debits, payout records). The admin-role check for
-- initiate_vendor_payout/confirm_vendor_payout happens in the
-- vendor-payout Edge Function (which uses the service_role key)
-- and razorpay-webhook (HMAC-verified, service_role). Following
-- the same pattern as migration 013's ban_user/unban_user/
-- assign_role fix: explicitly revoke execute from authenticated
-- and anon so no logged-in user can call
-- supabase.rpc('initiate_vendor_payout', {...}) directly from the
-- browser and drain a vendor's escrow balance themselves.
revoke execute on function compute_fee_split(numeric, numeric, numeric, numeric)         from authenticated, anon;
revoke execute on function record_delivery_split(uuid, text)                            from authenticated, anon;
revoke execute on function initiate_vendor_payout(uuid, numeric, text, text, uuid, text) from authenticated, anon;
revoke execute on function confirm_vendor_payout(uuid, text, text, text)                 from authenticated, anon;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'payment_rpcs',
  'migration_015: ported record_delivery_split/initiate_vendor_payout/confirm_vendor_payout/compute_fee_split from legacy database/ tree into the canonical, CI-deployed supabase/migrations/ tree — these were referenced by razorpay-webhook and vendor-payout but did not exist in the deployed schema'
);
