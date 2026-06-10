-- ═══════════════════════════════════════════════════════════
-- SETU — Phase 0 Payment Functions
-- ALL wallet mutations are security-definer Postgres functions.
-- No client JS should ever call UPDATE on wallets directly.
--
-- Functions:
--   credit_wallet             — atomic wallet credit (internal use)
--   debit_wallet              — alias for pay_from_wallet (internal use)
--   cancel_order_with_refund  — cancel + auto-refund in one transaction
--   credit_vendor_escrow      — called by webhook: escrow += vendor_amount
--   initiate_vendor_payout    — admin: escrow → bank (marks pending)
--   confirm_vendor_payout     — webhook/admin: mark payout paid
--   compute_fee_split         — pure helper: returns split amounts
--   record_delivery_split     — called by webhook after payment.captured
--   create_rider_payment_batch— admin: create weekly payout record
-- ═══════════════════════════════════════════════════════════

-- ── Helper: set the internal flag so the payment guard allows it ──
-- Called at the top of every function that legitimately touches payment_status.
create or replace function _set_internal_payment_flag()
returns void language plpgsql security definer as $$
begin
  perform set_config('setu.internal_payment_update', 'true', true); -- true = local to transaction
end;
$$;

-- ── credit_wallet ─────────────────────────────────────────
-- Atomically credits a wallet and logs the transaction.
-- SECURITY DEFINER: callers cannot set arbitrary balances.
-- p_source: 'refund' | 'topup' | 'bonus' | 'adjustment'
create or replace function credit_wallet(
  p_user_id    uuid,
  p_amount     numeric,
  p_description text,
  p_reference  text    default null,
  p_source     text    default 'adjustment'
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
  if p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Amount must be positive');
  end if;

  -- Upsert wallet; if first credit creates the row
  insert into wallets (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance    = wallets.balance + excluded.balance,
        updated_at = now()
  returning id, balance into v_wallet_id, v_new_balance;

  insert into wallet_transactions (
    wallet_id, user_id, type, amount, description, reference, status
  ) values (
    v_wallet_id, p_user_id, 'credit', p_amount, p_description, p_reference, 'completed'
  );

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    p_user_id, 'system', 'wallet_credit',
    p_user_id::text,
    format('₹%s credited (%s) ref:%s', p_amount, p_source, coalesce(p_reference,'—'))
  );

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- ── cancel_order_with_refund ──────────────────────────────
-- Single atomic transaction:
--   1. Validates order can be cancelled.
--   2. Updates order status to 'cancelled'.
--   3. If payment was captured (paid/collected), issues refund:
--      - Online payment (UPI/wallet): credit wallet immediately
--      - COD collected: manual refund record
--   4. Writes to order_refunds table.
--   5. Restores product stock.
--   6. Logs audit entry.
-- p_actor_role: 'customer' | 'vendor' | 'admin'
create or replace function cancel_order_with_refund(
  p_order_id    uuid,
  p_actor_id    uuid,
  p_actor_role  text    default 'customer',
  p_reason      text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order         orders%rowtype;
  v_refund_amount numeric;
  v_refund_method text;
  v_refund_id     uuid;
  v_cancellable   text[] := array['pending','confirmed','preparing'];
  v_wallet_result jsonb;
begin
  -- Allow payment_status to be updated in this session
  perform _set_internal_payment_flag();

  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

  -- Customers can only cancel their own orders
  if p_actor_role = 'customer' and v_order.customer_id != p_actor_id then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  -- Only cancellable statuses
  if not (v_order.status = any(v_cancellable)) then
    return jsonb_build_object(
      'success', false,
      'error',   format('Cannot cancel order in status: %s', v_order.status)
    );
  end if;

  -- Update order
  update orders set
    status        = 'cancelled',
    cancel_reason = coalesce(p_reason, cancel_reason),
    cancelled_at  = now(),
    updated_at    = now()
  where id = p_order_id;

  -- Restore product stock
  update products p
  set    stock = p.stock + oi.qty
  from   order_items oi
  where  oi.order_id = p_order_id
    and  oi.product_id = p.id;

  -- ── Refund logic ─────────────────────────────────────────
  -- Only refund if money was actually captured
  if v_order.payment_status in ('paid', 'collected') then

    v_refund_amount := v_order.total;

    -- Choose refund method based on payment method
    if v_order.payment_method in ('UPI', 'WALLET') then
      -- Instant wallet refund
      v_refund_method := 'wallet';

      v_wallet_result := credit_wallet(
        v_order.customer_id,
        v_refund_amount,
        format('Refund for cancelled order %s', v_order.order_number),
        p_order_id::text,
        'refund'
      );

      if not (v_wallet_result->>'success')::boolean then
        raise exception 'Wallet credit failed: %', v_wallet_result->>'error';
      end if;

      -- Mark order as refunded
      update orders set
        payment_status = 'refunded',
        updated_at     = now()
      where id = p_order_id;

    elsif v_order.payment_method = 'COD' and v_order.payment_status = 'collected' then
      -- COD was collected by rider; manual refund required
      v_refund_method := 'manual';
      -- payment_status stays 'collected'; refund record handles tracking
    else
      -- Payment pending (UPI order not yet captured), nothing to refund
      v_refund_method := 'wallet'; -- default; no actual credit needed
      v_refund_amount := 0;
    end if;

    -- Create refund record only if there's money to return
    if v_refund_amount > 0 then
      insert into order_refunds (
        order_id, customer_id, refund_amount, refund_method,
        status, cancel_reason, initiated_by
      ) values (
        p_order_id, v_order.customer_id, v_refund_amount, v_refund_method,
        case when v_refund_method = 'wallet' then 'completed'
             else 'pending' end,
        p_reason, p_actor_id
      )
      returning id into v_refund_id;

      if v_refund_method = 'wallet' then
        update order_refunds set
          status       = 'completed',
          completed_at = now()
        where id = v_refund_id;
      end if;
    end if;

  end if; -- end refund block

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    p_actor_id,
    coalesce((select name from profiles where id = p_actor_id), p_actor_role),
    'order_cancelled',
    v_order.order_number,
    format('Reason: %s | Refund: %s via %s',
      coalesce(p_reason, 'not specified'),
      coalesce(v_refund_amount::text, '₹0'),
      coalesce(v_refund_method, 'none'))
  );

  return jsonb_build_object(
    'success',        true,
    'order_id',       p_order_id,
    'refund_amount',  v_refund_amount,
    'refund_method',  v_refund_method
  );
end;
$$;

-- ── compute_fee_split ─────────────────────────────────────
-- Pure function: given order totals, returns split amounts.
-- Platform cut comes from platform_fee.
-- Rider earns a fixed ₹80 per delivery (can be changed per config).
-- Vendor gets: subtotal - platform_cut.
-- Delivery fee goes to rider.
create or replace function compute_fee_split(
  p_subtotal      numeric,
  p_delivery_fee  numeric,
  p_platform_fee  numeric,
  p_rider_base_fee numeric default 80
)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'vendor_amount',  p_subtotal - p_platform_fee,
    'platform_cut',   p_platform_fee,
    'rider_earning',  p_rider_base_fee + p_delivery_fee  -- rider gets base + delivery fee
  );
$$;

-- ── record_delivery_split ─────────────────────────────────
-- Called by the webhook handler on payment.captured.
-- Writes delivery_fee_splits + credits vendor_escrow atomically.
create or replace function record_delivery_split(
  p_order_id              uuid,
  p_razorpay_payment_id   text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order       orders%rowtype;
  v_split       jsonb;
  v_vendor_amt  numeric;
  v_platform    numeric;
  v_rider_earn  numeric;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

  -- Idempotency: skip if split already recorded
  if exists (select 1 from delivery_fee_splits where order_id = p_order_id) then
    return jsonb_build_object('success', true, 'skipped', true);
  end if;

  v_split      := compute_fee_split(v_order.subtotal, v_order.delivery_fee, v_order.platform_fee);
  v_vendor_amt := (v_split->>'vendor_amount')::numeric;
  v_platform   := (v_split->>'platform_cut')::numeric;
  v_rider_earn := (v_split->>'rider_earning')::numeric;

  -- Write immutable split record
  insert into delivery_fee_splits (
    order_id, order_total, subtotal, delivery_fee, platform_fee,
    vendor_amount, platform_cut, rider_earning,
    payment_method, razorpay_payment_id
  ) values (
    p_order_id, v_order.total, v_order.subtotal, v_order.delivery_fee, v_order.platform_fee,
    v_vendor_amt, v_platform, v_rider_earn,
    v_order.payment_method, p_razorpay_payment_id
  );

  -- Credit vendor escrow atomically
  insert into vendor_escrow (vendor_id, balance, total_credited)
  values (v_order.vendor_id, v_vendor_amt, v_vendor_amt)
  on conflict (vendor_id) do update
    set balance         = vendor_escrow.balance + excluded.balance,
        total_credited  = vendor_escrow.total_credited + excluded.total_credited,
        updated_at      = now();

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
-- Admin-triggered: move funds from escrow to vendor bank.
-- Creates vendor_payouts record; actual Razorpay Route call
-- is made by the Edge Function which then calls confirm_vendor_payout.
create or replace function initiate_vendor_payout(
  p_vendor_id      uuid,
  p_amount         numeric,
  p_method         text    default 'razorpay_route',
  p_bank_ref       text    default null,
  p_initiated_by   uuid    default null,
  p_notes          text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escrow  vendor_escrow%rowtype;
  v_payout_id uuid;
begin
  -- Only admins may initiate
  if p_initiated_by is not null and not (select is_admin()) then
    return jsonb_build_object('success', false, 'error', 'Admin role required');
  end if;

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

  -- Reserve funds by debiting escrow immediately (prevents double-payout)
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
-- Called by webhook (refund.created / payout webhook) or admin.
-- p_status: 'paid' | 'failed'
create or replace function confirm_vendor_payout(
  p_payout_id            uuid,
  p_status               text,
  p_razorpay_payout_id   text    default null,
  p_failure_reason       text    default null
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
    return jsonb_build_object('success', false, 'error', 'Payout already finalised');
  end if;

  update vendor_payouts set
    status               = p_status,
    razorpay_payout_id   = coalesce(p_razorpay_payout_id, razorpay_payout_id),
    failure_reason       = p_failure_reason,
    paid_at              = case when p_status = 'paid' then now() else null end,
    updated_at           = now()
  where id = p_payout_id;

  -- If payout failed, return funds to escrow
  if p_status = 'failed' then
    update vendor_escrow set
      balance    = balance + v_payout.amount,
      updated_at = now()
    where vendor_id = v_payout.vendor_id;
  else
    -- Confirmed paid: update total_paid_out counter
    update vendor_escrow set
      total_paid_out = total_paid_out + v_payout.amount,
      updated_at     = now()
    where vendor_id = v_payout.vendor_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    null, 'system',
    'vendor_payout_' || p_status,
    v_payout.vendor_id::text,
    format('Payout %s: ₹%s %s',
      p_payout_id, v_payout.amount,
      coalesce(p_failure_reason, ''))
  );

  return jsonb_build_object('success', true, 'payout_id', p_payout_id, 'status', p_status);
end;
$$;

-- ── create_rider_payment_batch ────────────────────────────
-- Admin creates a payout batch for a rider for a date range.
-- Aggregates delivery_fee_splits.rider_earning for delivered orders.
create or replace function create_rider_payment_batch(
  p_rider_id     uuid,
  p_period_start date,
  p_period_end   date,
  p_method       text    default 'bank_transfer',
  p_adjustments  numeric default 0,
  p_notes        text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross    numeric;
  v_count    integer;
  v_net      numeric;
  v_batch_id uuid;
begin
  -- Idempotency: don't duplicate an existing batch for the same period
  if exists (
    select 1 from rider_payments
    where rider_id = p_rider_id
      and period_start = p_period_start
      and period_end   = p_period_end
  ) then
    return jsonb_build_object('success', false, 'error', 'Batch already exists for this period');
  end if;

  -- Sum rider earnings from delivered orders in the period
  select
    coalesce(sum(dfs.rider_earning), 0),
    count(*)
  into v_gross, v_count
  from delivery_fee_splits dfs
  join orders o on o.id = dfs.order_id
  join riders r on r.id = p_rider_id
  where o.rider_id    = p_rider_id
    and o.status      = 'delivered'
    and o.delivered_at::date between p_period_start and p_period_end;

  v_net := v_gross + p_adjustments;

  if v_net <= 0 then
    return jsonb_build_object('success', false, 'error', 'No earnings to pay out for this period');
  end if;

  insert into rider_payments (
    rider_id, period_start, period_end,
    deliveries_count, gross_earnings, adjustments, net_payout,
    status, payout_method, notes
  ) values (
    p_rider_id, p_period_start, p_period_end,
    v_count, v_gross, p_adjustments, v_net,
    'pending', p_method, p_notes
  )
  returning id into v_batch_id;

  return jsonb_build_object(
    'success',      true,
    'batch_id',     v_batch_id,
    'gross',        v_gross,
    'adjustments',  p_adjustments,
    'net_payout',   v_net,
    'deliveries',   v_count
  );
end;
$$;

-- ── confirm_rider_payment ─────────────────────────────────
-- Called after actual bank transfer completes.
create or replace function confirm_rider_payment(
  p_batch_id           uuid,
  p_status             text,   -- 'paid' | 'failed'
  p_razorpay_payout_id text    default null,
  p_failure_reason     text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch rider_payments%rowtype;
begin
  select * into v_batch from rider_payments where id = p_batch_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Batch not found');
  end if;

  if v_batch.status not in ('pending','processing') then
    return jsonb_build_object('success', false, 'error', 'Batch already finalised');
  end if;

  update rider_payments set
    status               = p_status,
    razorpay_payout_id   = coalesce(p_razorpay_payout_id, razorpay_payout_id),
    failure_reason       = p_failure_reason,
    paid_at              = case when p_status = 'paid' then now() else null end,
    updated_at           = now()
  where id = p_batch_id;

  -- On success, zero out today_earnings (it resets to zero; total stays)
  if p_status = 'paid' then
    update riders set
      today_earnings = 0,
      updated_at     = now()
    where id = v_batch.rider_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    null, 'system', 'rider_payment_' || p_status,
    v_batch.rider_id::text,
    format('Batch %s: ₹%s for %s-%s',
      p_batch_id, v_batch.net_payout, v_batch.period_start, v_batch.period_end)
  );

  return jsonb_build_object('success', true, 'batch_id', p_batch_id, 'status', p_status);
end;
$$;

-- ── Repoint update_order_status to use internal flag ──────
-- Replace the existing update_order_status to set the flag
-- so the guard trigger allows status transitions from our functions.
create or replace function update_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_actor_id   uuid  default null,
  p_meta       jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order   orders%rowtype;
  v_allowed text[];
begin
  -- Allow payment_status updates from this security-definer context
  perform _set_internal_payment_flag();

  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  v_allowed := case v_order.status
    when 'pending'    then array['confirmed','cancelled']
    when 'confirmed'  then array['preparing','cancelled']
    when 'preparing'  then array['ready']
    when 'ready'      then array['picked_up']
    when 'picked_up'  then array['on_the_way']
    when 'on_the_way' then array['delivered']
    else array[]::text[]
  end;

  if not (p_new_status = any(v_allowed)) then
    return jsonb_build_object(
      'error', 'Invalid transition: ' || v_order.status || ' → ' || p_new_status
    );
  end if;

  update orders set
    status        = p_new_status,
    updated_at    = now(),
    confirmed_at  = case when p_new_status = 'confirmed'  then now() else confirmed_at  end,
    ready_at      = case when p_new_status = 'ready'      then now() else ready_at      end,
    picked_up_at  = case when p_new_status = 'picked_up'  then now() else picked_up_at  end,
    delivered_at  = case when p_new_status = 'delivered'  then now() else delivered_at  end,
    cancelled_at  = case when p_new_status = 'cancelled'  then now() else cancelled_at  end,
    cancel_reason = coalesce(p_meta->>'cancel_reason', cancel_reason),
    rider_id      = coalesce((p_meta->>'rider_id')::uuid, rider_id),
    rider_name    = coalesce(p_meta->>'rider_name', rider_name)
  where id = p_order_id;

  if p_new_status = 'delivered' and v_order.rider_id is not null then
    update riders set
      today_deliveries = today_deliveries + 1,
      total_deliveries = total_deliveries + 1,
      -- today_earnings updated via delivery_fee_splits; keep legacy column in sync
      today_earnings   = today_earnings + 80,
      total_earnings   = total_earnings + 80,
      cod_balance      = case when v_order.is_cod
                              then cod_balance + v_order.total
                              else cod_balance end
    where id = v_order.rider_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    p_actor_id,
    coalesce((select name from profiles where id = p_actor_id), 'System'),
    'order_' || p_new_status,
    v_order.order_number,
    'Status: ' || v_order.status || ' → ' || p_new_status
  );

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
end;
$$;
