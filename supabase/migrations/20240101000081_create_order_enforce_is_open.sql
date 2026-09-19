-- ═══════════════════════════════════════════════════════════════
-- Migration 081: create_order() now rejects orders for closed vendors
--
-- PROBLEM
-- The vendor's "Store Open" toggle (vendors.is_open) was purely
-- cosmetic everywhere it was read: CustomerHome, CustomerSearch,
-- CustomerVendors and CustomerVendorProfile all use is_open only to
-- colour a badge / show a "Closed" overlay. Nothing ever stopped a
-- customer from opening a closed vendor's page, adding items to the
-- cart, and completing checkout — create_order() only ever checked
-- v_vendor.is_active (suspended/deleted vendors), never
-- v_vendor.is_open (the vendor's own day-to-day open/closed toggle).
--
-- FIX
-- create_order() now also rejects, with a distinct customer-facing
-- message, when the target vendor is currently closed. This is
-- enforced server-side (the RPC is the source of truth regardless of
-- what a client sends) — CustomerCheckout.jsx already surfaces
-- placeOrder()'s returned error message directly to the customer, so
-- no client-side changes are needed for this to show up cleanly.
--
-- OPERATIONAL NOTE FOR WHOEVER APPLIES THIS
-- vendors.is_open is `not null default false` (migration 001) — every
-- vendor row starts closed until explicitly opened. Saving that
-- toggle from the Vendor Settings page was, until just now, crashing
-- on every attempt (a separate bug, now fixed client-side), so any
-- vendor who onboarded before that fix shipped may currently have
-- is_open = false in the database despite believing/intending their
-- shop to be open. Applying this migration makes that column
-- enforcement-relevant for the first time — double check existing
-- verified/active vendors' is_open values (and prompt them to open
-- their store from Settings) before/after deploying this, so real
-- shops aren't suddenly unable to receive orders.
--
-- Everything else in this function is unchanged from migration 053
-- (coupon row-lock fix) — only the new is_open check below is added.
-- ═══════════════════════════════════════════════════════════════

create or replace function create_order(
  p_vendor_id       uuid,
  p_items           jsonb,
  p_payment_method  text    default 'COD',
  p_delivery_address text   default null,
  p_village_id      text    default null,
  p_delivery_notes  text    default null,
  p_use_credit      boolean default false,
  p_coupon_code     text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_customer_name   text;
  v_vendor          vendors%rowtype;
  v_item            jsonb;
  v_product         products%rowtype;
  v_qty             integer;
  v_subtotal        numeric(10,2) := 0;
  v_credit_discount numeric(10,2) := 0;
  v_coupon_discount numeric(10,2) := 0;
  v_coupon_id       uuid;
  v_coupon          jsonb;
  v_final           numeric(10,2);
  v_delivery_fee    numeric(10,2);
  v_platform_fee    numeric(10,2);
  v_total           numeric(10,2);
  v_order_id        uuid;
  v_order_number    text;
  v_credit          credit_accounts%rowtype;
  v_available       numeric(12,2);
  v_rows            integer;
  v_cfg             jsonb := get_fee_config();
  v_lock_id         uuid;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;
  if p_payment_method not in ('COD', 'UPI', 'wallet', 'credit') then
    return jsonb_build_object('success', false, 'error', 'Invalid payment method');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'error', 'Order must contain at least one item');
  end if;

  select * into v_vendor from vendors where id = p_vendor_id;
  if not found or not v_vendor.is_active then
    return jsonb_build_object('success', false, 'error', 'Vendor not available');
  end if;
  -- NEW (migration 081): reject orders for a vendor that has toggled
  -- themselves closed. Distinct message from the is_active check above
  -- so customers (and support) can tell "this shop doesn't take orders
  -- at all" apart from "this shop is closed right now".
  if not v_vendor.is_open then
    return jsonb_build_object('success', false, 'error', 'This shop is currently closed. Please try again when they reopen.');
  end if;

  select name into v_customer_name from profiles where id = v_uid;
  v_order_number := 'SETU-' || to_char(nextval('order_number_seq'), 'FM000000');

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

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'qty')::integer, 0);
    if v_qty <= 0 then raise exception 'Invalid quantity for item %', v_item->>'product_id'; end if;

    select * into v_product from products where id = (v_item->>'product_id')::uuid;
    if not found then raise exception 'Product % not found', v_item->>'product_id'; end if;
    if v_product.vendor_id <> p_vendor_id then raise exception 'Product % does not belong to this vendor', v_product.id; end if;
    if not v_product.is_available then raise exception 'Product "%" is not available', v_product.name; end if;

    update products set stock = stock - v_qty, updated_at = now()
     where id = v_product.id and stock >= v_qty;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Insufficient stock for "%": only % left', v_product.name, v_product.stock; end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    insert into order_items (order_id, product_id, name, qty, price)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_product.price);
  end loop;

  -- ── Coupon (server-validated; raises with the reason if invalid) ──
  -- PASS 5 FIX (DATA-02): lock the coupon row for the remainder of
  -- this transaction BEFORE evaluating/redeeming it, so a concurrent
  -- create_order() call for the same coupon blocks here until we
  -- commit or roll back, instead of racing past a stale count.
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select id into v_lock_id
      from coupons
     where upper(code) = upper(trim(p_coupon_code))
     for update;
    -- If no such coupon exists, v_lock_id stays null and
    -- _evaluate_coupon()'s own "not found" check below reports the
    -- correct "Invalid or inactive coupon" reason — no crash.

    v_coupon := _evaluate_coupon(p_coupon_code, v_subtotal, p_vendor_id, v_uid);
    if not (v_coupon->>'valid')::boolean then
      raise exception '%', coalesce(v_coupon->>'reason', 'Invalid coupon');
    end if;
    v_coupon_discount := (v_coupon->>'discount')::numeric;
    v_coupon_id       := (v_coupon->>'coupon_id')::uuid;
  end if;

  -- ── Backed SETU Credit discount (config-driven) ──
  if p_use_credit then
    select * into v_credit from credit_accounts where user_id = v_uid;
    if not found or v_credit.status <> 'active' then
      raise exception 'SETU Credit is not available on your account';
    end if;
    v_credit_discount := least(
      round(v_subtotal * (v_cfg->>'credit_discount_pct')::numeric / 100, 2),
      (v_cfg->>'credit_discount_max')::numeric
    );
    v_available := v_credit.credit_limit - v_credit.outstanding;
    if v_available < v_credit_discount then
      raise exception 'Insufficient SETU Credit (available ₹%)', v_available;
    end if;
    update credit_accounts set outstanding = outstanding + v_credit_discount, updated_at = now() where id = v_credit.id;
    insert into credit_transactions (account_id, user_id, type, amount, purpose, status)
    values (v_credit.id, v_uid, 'disbursement', v_credit_discount, 'Order discount ' || v_order_number, 'active');
  end if;

  -- ── Fees ── (discounts never push the final below zero)
  v_final        := greatest(0, v_subtotal - v_credit_discount - v_coupon_discount);
  v_delivery_fee := case when v_subtotal >= (v_cfg->>'free_threshold')::numeric then 0 else (v_cfg->>'delivery_flat')::numeric end;
  v_platform_fee := round(v_final * (v_cfg->>'commission_pct')::numeric / 100);
  v_total        := v_final + v_delivery_fee + v_platform_fee;

  update orders set
    subtotal = v_subtotal, delivery_fee = v_delivery_fee, platform_fee = v_platform_fee, total = v_total,
    coupon_code = case when v_coupon_id is not null then upper(trim(p_coupon_code)) else null end,
    coupon_discount = v_coupon_discount, updated_at = now()
  where id = v_order_id;

  -- ── Record coupon redemption atomically with the order ──
  -- (Safe now: we hold the row lock on this coupon acquired above,
  -- so no concurrent transaction could have redeemed it between our
  -- validation and this insert.)
  if v_coupon_id is not null then
    insert into coupon_redemptions (coupon_id, user_id, order_id, discount)
    values (v_coupon_id, v_uid, v_order_id, v_coupon_discount);
    update coupons set used_count = used_count + 1, updated_at = now() where id = v_coupon_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (v_uid, coalesce(v_customer_name, 'customer'), 'order_created', v_order_number,
    format('subtotal=₹%s credit=₹%s coupon=₹%s delivery=₹%s platform=₹%s total=₹%s method=%s',
           v_subtotal, v_credit_discount, v_coupon_discount, v_delivery_fee, v_platform_fee, v_total, p_payment_method));

  return jsonb_build_object(
    'success', true, 'id', v_order_id, 'order_number', v_order_number,
    'status', 'pending', 'payment_status', 'pending', 'payment_method', p_payment_method,
    'vendor_id', v_vendor.id, 'vendor_name', v_vendor.name,
    'subtotal', v_subtotal, 'credit_discount', v_credit_discount, 'coupon_discount', v_coupon_discount,
    'delivery_fee', v_delivery_fee, 'platform_fee', v_platform_fee, 'total', v_total
  );
end;
$$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'vendors,create_order',
  'migration_081: create_order now rejects orders where the target vendor has is_open = false, closing the gap where the Store Open toggle only ever affected customer-facing badges/overlays and never actually blocked checkout. No schema change — vendors.is_open already existed (not null default false, migration 001).'
);
