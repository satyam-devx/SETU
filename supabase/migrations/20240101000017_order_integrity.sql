-- ═══════════════════════════════════════════════════════════════
-- Migration 017: Order & Money Integrity (Phase 1 — launch blockers)
--
-- Closes the three live, exploitable money-trust holes that the prior
-- two audit rounds missed (see audit Phase 4):
--
--   CRITICAL-A  Order totals & item prices were 100% client-controlled.
--               Orders were created by a DIRECT browser INSERT
--               (src/lib/api.js placeOrder → supabase.from('orders')
--               .insert(...)), and RLS only checked
--               `customer_id = auth.uid()` — never that `total`,
--               `subtotal`, or item `price` matched the products table.
--               An attacker could insert an order with total=1 for
--               real goods, pay ₹1, and the webhook's amount
--               "reconciliation" passed because it trusts orders.total.
--               → FIX: create_order() recomputes everything server-side
--                 from products.price. The client can no longer set
--                 any monetary field. Stock is decremented atomically
--                 (prevents oversell). The legacy direct INSERT path
--                 is locked out by revoking client INSERT on orders.
--
--   CRITICAL-B  update_order_status() (security definer) had NO caller
--               authorization — any authenticated user could advance
--               any order and, on 'delivered', credit an ARBITRARY
--               rider's earnings/cod_balance via p_meta.rider_id.
--               → FIX: role-aware permission matrix derived from
--                 auth.uid(); p_meta.rider_id/rider_name honoured only
--                 for admin/service callers; delivered-crediting uses
--                 the order's already-assigned rider.
--
--   CRITICAL-C  "Use SETU Credit" gave up to ₹500 (10%) off with NO
--               credit-account check and NO debit — free money.
--               → FIX: create_order() only grants the discount when the
--                 caller has an ACTIVE credit account with sufficient
--                 available credit, and records it as a real credit
--                 drawdown (outstanding += discount, credit_transactions
--                 'disbursement'). [BUSINESS ASSUMPTION — confirm with
--                 product: this treats the discount as credit-funded,
--                 i.e. repayable, rather than a free promo. If it is
--                 meant to be a funded promo, replace the drawdown with
--                 a promo-budget check instead.]
--
--   #4 (HIGH)   Payment amount divergence: wallet/UPI were charged the
--               client's grandTotal while orders.total differed.
--               → FIX: pay_order_from_wallet() charges exactly
--                 orders.total; UPI already uses orders.total in
--                 create-razorpay-order. Nothing monetary flows from
--                 the client anymore.
--
--   #5 (HIGH)   cancel_order_with_refund() + credit_wallet() existed
--               ONLY in the legacy database/ tree (NOT CI-deployed),
--               yet checkout calls cancel_order_with_refund on every
--               UPI-cancel / wallet-failure. On a fresh deploy this
--               threw "function does not exist".
--               → FIX: ported here, with authz hardened to derive the
--                 actor role from auth.uid() instead of trusting a
--                 client-supplied p_actor_role.
--
-- NOTE: compute_fee_split / record_delivery_split / initiate_vendor_payout
-- / confirm_vendor_payout were already ported in migration 015 and are
-- NOT redefined here.
-- ═══════════════════════════════════════════════════════════════

-- ── 0. Internal payment-flag helper ─────────────────────────────
-- The migration-008 guard trigger (guard_payment_status_change) blocks
-- any non-service-role session from changing orders.payment_status
-- unless this session-local flag is set. Our security-definer money
-- functions set it before touching payment_status. (Defined only in
-- the legacy tree before this migration — another deploy gap.)
create or replace function _set_internal_payment_flag()
returns void
language plpgsql
security definer
as $$
begin
  perform set_config('setu.internal_payment_update', 'true', true); -- tx-local
end;
$$;

revoke execute on function _set_internal_payment_flag() from authenticated, anon;

-- ── 1. credit_wallet (ported from legacy; internal only) ─────────
-- Atomic wallet credit + audit. Used by cancel_order_with_refund for
-- instant refunds. Never callable from the browser.
create or replace function credit_wallet(
  p_user_id     uuid,
  p_amount      numeric,
  p_description text,
  p_reference   text default null,
  p_source      text default 'adjustment'
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
    p_user_id, 'system', 'wallet_credit', p_user_id::text,
    format('₹%s credited (%s) ref:%s', p_amount, p_source, coalesce(p_reference, '—'))
  );

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

revoke execute on function credit_wallet(uuid, numeric, text, text, text) from authenticated, anon;

-- ── 2. create_order — server-authoritative order creation ───────
-- CRITICAL-A + CRITICAL-C fix.
--
-- The customer is ALWAYS auth.uid() — never a client parameter.
-- p_items is an array of { product_id, qty }; any price/total the
-- client sends is ignored. Every price is reloaded from products,
-- every product is verified to belong to p_vendor_id and be
-- available, and stock is decremented atomically (oversell-safe).
--
-- Fee math mirrors the previous client formula EXACTLY so totals
-- don't shift for legitimate orders:
--   credit_discount = use_credit ? least(round(subtotal*0.10,2), 500) : 0  (if eligible)
--   final           = subtotal - credit_discount
--   delivery_fee    = subtotal >= 200 ? 0 : 20
--   platform_fee    = round(final * 0.01)
--   total           = final + delivery_fee + platform_fee
create or replace function create_order(
  p_vendor_id       uuid,
  p_items           jsonb,
  p_payment_method  text    default 'COD',
  p_delivery_address text   default null,
  p_village_id      text    default null,
  p_delivery_notes  text    default null,
  p_use_credit      boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid            uuid := auth.uid();
  v_customer_name  text;
  v_vendor         vendors%rowtype;
  v_item           jsonb;
  v_product        products%rowtype;
  v_qty            integer;
  v_subtotal       numeric(10,2) := 0;
  v_credit_discount numeric(10,2) := 0;
  v_final          numeric(10,2);
  v_delivery_fee   numeric(10,2);
  v_platform_fee   numeric(10,2);
  v_total          numeric(10,2);
  v_order_id       uuid;
  v_order_number   text;
  v_credit         credit_accounts%rowtype;
  v_available      numeric(12,2);
  v_rows           integer;
begin
  -- Identity comes from the JWT only.
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  if p_payment_method not in ('COD', 'UPI', 'wallet', 'credit') then
    return jsonb_build_object('success', false, 'error', 'Invalid payment method');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'error', 'Order must contain at least one item');
  end if;

  -- Vendor must exist and be active.
  select * into v_vendor from vendors where id = p_vendor_id;
  if not found or not v_vendor.is_active then
    return jsonb_build_object('success', false, 'error', 'Vendor not available');
  end if;

  select name into v_customer_name from profiles where id = v_uid;

  -- Reserve the order number now (collision-free sequence).
  v_order_number := 'SETU-' || to_char(nextval('order_number_seq'), 'FM000000');

  -- Create the order shell first so order_items can reference it.
  insert into orders (
    id, order_number, customer_id, customer_name,
    vendor_id, vendor_name, village_id, village,
    status, payment_method, payment_status,
    subtotal, delivery_fee, platform_fee, total,
    is_cod, delivery_address, delivery_notes
  ) values (
    gen_random_uuid(), v_order_number, v_uid, coalesce(v_customer_name, 'Customer'),
    v_vendor.id, v_vendor.name, coalesce(p_village_id, v_vendor.village_id), v_vendor.village,
    'pending', p_payment_method, 'pending',
    0, 0, 0, 0,
    (p_payment_method = 'COD'), p_delivery_address, p_delivery_notes
  )
  returning id into v_order_id;

  -- ── Recompute every line from the products table ──────────────
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'qty')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity for item %', v_item->>'product_id';
    end if;

    select * into v_product
    from products
    where id = (v_item->>'product_id')::uuid;

    if not found then
      raise exception 'Product % not found', v_item->>'product_id';
    end if;
    if v_product.vendor_id <> p_vendor_id then
      raise exception 'Product % does not belong to this vendor', v_product.id;
    end if;
    if not v_product.is_available then
      raise exception 'Product "%" is not available', v_product.name;
    end if;

    -- Atomic stock decrement — prevents overselling under concurrency.
    update products
       set stock = stock - v_qty,
           updated_at = now()
     where id = v_product.id
       and stock >= v_qty;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'Insufficient stock for "%": only % left', v_product.name, v_product.stock;
    end if;

    -- Price is the server's price, never the client's.
    v_subtotal := v_subtotal + (v_product.price * v_qty);

    insert into order_items (order_id, product_id, name, qty, price)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_product.price);
  end loop;

  -- ── CRITICAL-C: backed SETU Credit discount ───────────────────
  if p_use_credit then
    select * into v_credit from credit_accounts where user_id = v_uid;

    if not found or v_credit.status <> 'active' then
      raise exception 'SETU Credit is not available on your account';
    end if;

    v_credit_discount := least(round(v_subtotal * 0.10, 2), 500);
    v_available := v_credit.credit_limit - v_credit.outstanding;

    if v_available < v_credit_discount then
      raise exception 'Insufficient SETU Credit (available ₹%)', v_available;
    end if;

    -- Record the drawdown: the discount is funded by the customer's
    -- credit line and must be repaid (outstanding increases).
    update credit_accounts
       set outstanding = outstanding + v_credit_discount,
           updated_at  = now()
     where id = v_credit.id;

    insert into credit_transactions (account_id, user_id, type, amount, purpose, status)
    values (v_credit.id, v_uid, 'disbursement', v_credit_discount,
            'Order discount ' || v_order_number, 'active');
  end if;

  -- ── Fee math (mirrors prior client formula) ───────────────────
  v_final        := v_subtotal - v_credit_discount;
  v_delivery_fee := case when v_subtotal >= 200 then 0 else 20 end;
  v_platform_fee := round(v_final * 0.01);
  v_total        := v_final + v_delivery_fee + v_platform_fee;

  update orders set
    subtotal     = v_subtotal,
    delivery_fee = v_delivery_fee,
    platform_fee = v_platform_fee,
    total        = v_total,
    updated_at   = now()
  where id = v_order_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    v_uid, coalesce(v_customer_name, 'customer'), 'order_created', v_order_number,
    format('subtotal=₹%s discount=₹%s delivery=₹%s platform=₹%s total=₹%s method=%s',
           v_subtotal, v_credit_discount, v_delivery_fee, v_platform_fee, v_total, p_payment_method)
  );

  return jsonb_build_object(
    'success',         true,
    'id',              v_order_id,
    'order_number',    v_order_number,
    'status',          'pending',
    'payment_status',  'pending',
    'payment_method',  p_payment_method,
    'vendor_id',       v_vendor.id,
    'vendor_name',     v_vendor.name,
    'subtotal',        v_subtotal,
    'credit_discount', v_credit_discount,
    'delivery_fee',    v_delivery_fee,
    'platform_fee',    v_platform_fee,
    'total',           v_total
  );
end;
$$;

grant execute on function create_order(uuid, jsonb, text, text, text, text, boolean) to authenticated;

-- ── 2b. Lock out the legacy client-side direct INSERT path ──────
-- create_order() is now the ONLY sanctioned way to create an order.
-- The old policy let the browser insert arbitrary subtotal/total/price.
-- Reads/updates (customer cancel) are unaffected.
drop policy if exists "orders_customer_insert" on orders;
-- order_items are written by create_order (security definer, bypasses RLS).
-- Remove the client INSERT policy so a crafted order can't get cheap items.
drop policy if exists "order_items_insert_own" on order_items;

-- ── 3. pay_order_from_wallet — atomic wallet checkout (#4 fix) ───
-- Charges EXACTLY orders.total (server value), debits the caller's
-- own wallet atomically, confirms the order, and credits vendor
-- escrow — all in one transaction. Removes the client grandTotal
-- from the money path entirely.
create or replace function pay_order_from_wallet(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_order       orders%rowtype;
  v_wallet_id   uuid;
  v_new_balance numeric;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;
  if v_order.customer_id <> v_uid then
    return jsonb_build_object('success', false, 'error', 'Not your order');
  end if;
  if v_order.payment_status <> 'pending' or v_order.status <> 'pending' then
    return jsonb_build_object('success', false, 'error', 'Order is not awaiting payment');
  end if;

  -- Atomic debit of the AUTHORITATIVE total, only if balance suffices.
  update wallets
     set balance    = balance - v_order.total,
         updated_at = now()
   where user_id = v_uid
     and balance >= v_order.total
  returning id, balance into v_wallet_id, v_new_balance;

  if not found then
    if exists (select 1 from wallets where user_id = v_uid) then
      return jsonb_build_object(
        'success', false, 'insufficient_funds', true,
        'balance', (select balance from wallets where user_id = v_uid),
        'required', v_order.total
      );
    end if;
    return jsonb_build_object('success', false, 'error', 'Wallet not found');
  end if;

  insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
  values (v_wallet_id, v_uid, 'debit', v_order.total,
          'Order payment ' || v_order.order_number, p_order_id::text, 'completed');

  -- Confirm the order (guard trigger allows it via the internal flag).
  perform _set_internal_payment_flag();
  update orders set
    payment_status = 'paid',
    status         = 'confirmed',
    confirmed_at   = now(),
    updated_at     = now()
  where id = p_order_id;

  -- Credit vendor escrow exactly as the online-payment webhook does.
  perform record_delivery_split(p_order_id, null);

  insert into audit_log (actor_id, actor, action, target, detail)
  values (v_uid, coalesce((select name from profiles where id = v_uid), 'customer'),
          'order_paid_wallet', v_order.order_number, format('₹%s from wallet', v_order.total));

  return jsonb_build_object('success', true, 'new_balance', v_new_balance, 'total', v_order.total);
end;
$$;

grant execute on function pay_order_from_wallet(uuid) to authenticated;

-- ── 4. update_order_status — role-aware authorization (CRITICAL-B) ─
-- Derives the caller from auth.uid() and enforces a per-role
-- transition matrix. p_meta.rider_id/rider_name are honoured ONLY
-- for admin/service callers (a rider can no longer credit a
-- different rider's earnings). delivered-crediting uses the order's
-- already-assigned rider.
create or replace function update_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_actor_id   uuid  default null,   -- ignored for authz; kept for signature compat
  p_meta       jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_role      text;
  v_order     orders%rowtype;
  v_allowed   text[];
  v_is_vendor boolean := false;
  v_is_rider  boolean := false;
  v_is_customer boolean := false;
  v_is_admin  boolean := false;
  v_is_backend boolean := (auth.uid() is null);  -- service_role / internal
  v_role_allowed text[];
  v_apply_meta boolean;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  -- ── Identify the caller's relationship to this order ──────────
  if not v_is_backend then
    v_role := get_my_role();
    v_is_admin := v_role in ('admin', 'super_admin');
    v_is_customer := (v_order.customer_id = v_uid);
    v_is_vendor := exists (
      select 1 from vendors where id = v_order.vendor_id and owner_id = v_uid
    );
    v_is_rider := v_order.rider_id is not null and exists (
      select 1 from riders where id = v_order.rider_id and user_id = v_uid
    );

    if not (v_is_admin or v_is_vendor or v_is_rider or v_is_customer) then
      return jsonb_build_object('error', 'Unauthorized: you cannot modify this order');
    end if;

    -- Per-role allowed target statuses.
    v_role_allowed := case
      when v_is_admin    then array['confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled']
      when v_is_vendor   then array['confirmed','preparing','ready','cancelled']
      when v_is_rider    then array['picked_up','on_the_way','delivered']
      when v_is_customer then array['cancelled']
      else array[]::text[]
    end;

    if not (p_new_status = any(v_role_allowed)) then
      return jsonb_build_object('error', format('Your role (%s) cannot set status %s', coalesce(v_role,'?'), p_new_status));
    end if;
  end if;

  -- ── State-machine validity (applies to everyone) ──────────────
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
    return jsonb_build_object('error', 'Invalid transition: ' || v_order.status || ' → ' || p_new_status);
  end if;

  -- rider_id / rider_name from meta only trusted for admin/backend.
  v_apply_meta := v_is_admin or v_is_backend;

  update orders set
    status        = p_new_status,
    updated_at    = now(),
    confirmed_at  = case when p_new_status = 'confirmed'  then now() else confirmed_at  end,
    ready_at      = case when p_new_status = 'ready'      then now() else ready_at      end,
    picked_up_at  = case when p_new_status = 'picked_up'  then now() else picked_up_at  end,
    delivered_at  = case when p_new_status = 'delivered'  then now() else delivered_at  end,
    cancelled_at  = case when p_new_status = 'cancelled'  then now() else cancelled_at  end,
    cancel_reason = coalesce(p_meta->>'cancel_reason', cancel_reason),
    rider_id      = case when v_apply_meta then coalesce((p_meta->>'rider_id')::uuid, rider_id) else rider_id end,
    rider_name    = case when v_apply_meta then coalesce(p_meta->>'rider_name', rider_name) else rider_name end
  where id = p_order_id;

  -- Credit the order's OWN assigned rider on delivery (never a meta-supplied one).
  if p_new_status = 'delivered' and v_order.rider_id is not null then
    update riders set
      today_deliveries = today_deliveries + 1,
      total_deliveries = total_deliveries + 1,
      today_earnings   = today_earnings + 80,
      total_earnings   = total_earnings + 80,
      cod_balance      = case when v_order.is_cod then cod_balance + v_order.total else cod_balance end
    where id = v_order.rider_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    v_uid,
    coalesce((select name from profiles where id = v_uid), case when v_is_backend then 'system' else 'user' end),
    'order_' || p_new_status,
    v_order.order_number,
    format('Status: %s → %s (by %s)', v_order.status, p_new_status,
           case when v_is_backend then 'backend'
                when v_is_admin then 'admin'
                when v_is_vendor then 'vendor'
                when v_is_rider then 'rider'
                else 'customer' end)
  );

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
end;
$$;

grant execute on function update_order_status(uuid, text, uuid, jsonb) to authenticated;

-- ── 5. cancel_order_with_refund (ported + authz hardened) ───────
-- Was legacy-only (#5). Authz no longer trusts the client-supplied
-- p_actor_role: a real customer can only cancel their OWN order;
-- vendors only orders they own; admins/backend anything. The
-- p_actor_role parameter is kept for signature compatibility but is
-- NOT used to grant privilege.
create or replace function cancel_order_with_refund(
  p_order_id   uuid,
  p_actor_id   uuid  default null,
  p_actor_role text  default 'customer',
  p_reason     text  default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid           uuid := auth.uid();
  v_role          text;
  v_order         orders%rowtype;
  v_refund_amount numeric := 0;
  v_refund_method text;
  v_refund_id     uuid;
  v_cancellable   text[] := array['pending','confirmed','preparing'];
  v_wallet_result jsonb;
  v_is_backend    boolean := (auth.uid() is null);
  v_authorized    boolean := false;
begin
  perform _set_internal_payment_flag();

  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

  -- Authorization derived from the verified caller, not the body.
  if v_is_backend then
    v_authorized := true;
  else
    v_role := get_my_role();
    if v_role in ('admin', 'super_admin') then
      v_authorized := true;
    elsif v_order.customer_id = v_uid then
      v_authorized := true;
    elsif exists (select 1 from vendors where id = v_order.vendor_id and owner_id = v_uid) then
      v_authorized := true;
    end if;
  end if;

  if not v_authorized then
    return jsonb_build_object('success', false, 'error', 'Unauthorized');
  end if;

  if not (v_order.status = any(v_cancellable)) then
    return jsonb_build_object('success', false,
      'error', format('Cannot cancel order in status: %s', v_order.status));
  end if;

  update orders set
    status        = 'cancelled',
    cancel_reason = coalesce(p_reason, cancel_reason),
    cancelled_at  = now(),
    updated_at    = now()
  where id = p_order_id;

  -- Restore stock that create_order decremented.
  update products p
     set stock = p.stock + oi.qty,
         updated_at = now()
    from order_items oi
   where oi.order_id = p_order_id
     and oi.product_id = p.id;

  -- Refund only money actually captured.
  if v_order.payment_status in ('paid', 'collected') then
    if v_order.payment_method in ('UPI', 'wallet') then
      v_refund_method := 'wallet';
      v_refund_amount := v_order.total;

      v_wallet_result := credit_wallet(
        v_order.customer_id, v_refund_amount,
        format('Refund for cancelled order %s', v_order.order_number),
        p_order_id::text, 'refund'
      );
      if not (v_wallet_result->>'success')::boolean then
        raise exception 'Wallet credit failed: %', v_wallet_result->>'error';
      end if;

      update orders set payment_status = 'refunded', updated_at = now()
       where id = p_order_id;

      insert into order_refunds (
        order_id, customer_id, refund_amount, refund_method,
        status, cancel_reason, initiated_by, completed_at
      ) values (
        p_order_id, v_order.customer_id, v_refund_amount, 'wallet',
        'completed', p_reason, coalesce(v_uid, p_actor_id), now()
      );

    elsif v_order.payment_method = 'COD' and v_order.payment_status = 'collected' then
      -- Cash already collected by the rider — manual refund.
      v_refund_method := 'manual';
      v_refund_amount := v_order.total;
      insert into order_refunds (
        order_id, customer_id, refund_amount, refund_method,
        status, cancel_reason, initiated_by
      ) values (
        p_order_id, v_order.customer_id, v_refund_amount, 'manual',
        'pending', p_reason, coalesce(v_uid, p_actor_id)
      );
    end if;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    coalesce(v_uid, p_actor_id),
    coalesce((select name from profiles where id = v_uid), coalesce(v_role, 'backend')),
    'order_cancelled', v_order.order_number,
    format('Reason: %s | Refund: ₹%s via %s',
           coalesce(p_reason, 'not specified'), v_refund_amount, coalesce(v_refund_method, 'none'))
  );

  return jsonb_build_object(
    'success', true, 'order_id', p_order_id,
    'refund_amount', v_refund_amount, 'refund_method', v_refund_method
  );
end;
$$;

grant execute on function cancel_order_with_refund(uuid, uuid, text, text) to authenticated;

-- ── 6. Audit ────────────────────────────────────────────────────
insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'orders,order_items,credit,wallet',
  'migration_017: server-authoritative create_order (recomputes totals from products, atomic stock, backed credit discount); role-aware update_order_status (CRITICAL-B); pay_order_from_wallet charges authoritative total (#4); ported credit_wallet + cancel_order_with_refund into canonical tree (#5); revoked client INSERT on orders/order_items'
);
