-- ═══════════════════════════════════════════════════════════════
-- Migration 083: create_order() idempotency key
--
-- PROBLEM
-- create_order() had no protection against a genuine network-retry
-- double-submit: CustomerCheckout.jsx's re-entry guard (`if (placing)
-- return`) only stops a fast double-tap on the same button instance —
-- it does nothing if the RPC request reaches the server and succeeds,
-- but the response is lost in transit (dropped connection, timeout).
-- The client sees that as a failure, re-enables the button, and a
-- second tap calls create_order() again with the same cart — which
-- happily creates a second real order (and, for UPI, a second
-- Razorpay payment) with no way for the server to know it's a retry
-- of the same checkout attempt rather than a new one.
--
-- FIX
-- create_order() takes a new, optional p_idempotency_key. When the
-- client supplies one (a UUID generated once per checkout attempt,
-- not per tap) and an order with that exact (customer, key) pair
-- already exists, the function returns that existing order instead of
-- creating a new one — no second stock decrement, no second Razorpay
-- order, no duplicate row. Omitting the key (every existing caller,
-- including qa/sql/coupons_test.sql and friends) behaves exactly as
-- before — this is purely additive.
-- ═══════════════════════════════════════════════════════════════

alter table orders add column if not exists idempotency_key text;

-- Partial + composite: null keys (every order created before this
-- migration, and any caller that still doesn't pass one) are excluded
-- entirely, and two different customers can never collide with each
-- other even if their generated keys somehow matched.
create unique index if not exists idx_orders_idempotency
  on orders(customer_id, idempotency_key)
  where idempotency_key is not null;

create or replace function create_order(
  p_vendor_id       uuid,
  p_items           jsonb,
  p_payment_method  text    default 'COD',
  p_delivery_address text   default null,
  p_village_id      text    default null,
  p_delivery_notes  text    default null,
  p_use_credit      boolean default false,
  p_coupon_code     text    default null,
  p_idempotency_key text    default null
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
  v_existing        record;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  -- NEW (migration 083): idempotent replay — if this exact
  -- (customer, key) pair already produced an order, return it as-is
  -- rather than creating a second one. Checked before any validation
  -- below runs, so a retried request can't fail validation
  -- differently the second time and land in a confusing in-between
  -- state either.
  if p_idempotency_key is not null then
    select id, order_number, status, payment_status, payment_method,
           vendor_id, vendor_name, subtotal, coupon_discount,
           delivery_fee, platform_fee, total
      into v_existing
      from orders
     where customer_id = v_uid
       and idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'success', true, 'id', v_existing.id, 'order_number', v_existing.order_number,
        'status', v_existing.status, 'payment_status', v_existing.payment_status,
        'payment_method', v_existing.payment_method,
        'vendor_id', v_existing.vendor_id, 'vendor_name', v_existing.vendor_name,
        'subtotal', v_existing.subtotal, 'credit_discount', 0, 'coupon_discount', v_existing.coupon_discount,
        'delivery_fee', v_existing.delivery_fee, 'platform_fee', v_existing.platform_fee, 'total', v_existing.total,
        'replayed', true
      );
    end if;
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
    is_cod, delivery_address, delivery_notes, idempotency_key
  ) values (
    gen_random_uuid(), v_order_number, v_uid, coalesce(v_customer_name, 'Customer'),
    v_vendor.id, v_vendor.name, coalesce(p_village_id, v_vendor.village_id), v_vendor.village,
    'pending', p_payment_method, 'pending',
    0, 0, 0, 0,
    (p_payment_method = 'COD'), p_delivery_address, p_delivery_notes, p_idempotency_key
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
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select id into v_lock_id
      from coupons
     where upper(code) = upper(trim(p_coupon_code))
     for update;

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

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'orders,create_order', 'table',
  'migration_083: create_order() now accepts an optional p_idempotency_key — a retried call with a key that already produced an order for that customer returns the existing order instead of creating a duplicate. Added orders.idempotency_key (nullable) + a per-customer partial unique index. Fully backward compatible — omitting the key behaves exactly as before.'
);
