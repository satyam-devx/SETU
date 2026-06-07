-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — DATABASE FUNCTIONS & RPCs
-- Run after schema.sql
-- These are called from api.js via supabase.rpc()
-- ═══════════════════════════════════════════════════════════

-- ── place_order ───────────────────────────────────────────
-- Atomically creates an order + order_items in one transaction.
-- Returns the created order with items.
create or replace function place_order(
  p_customer_id     uuid,
  p_customer_name   text,
  p_vendor_id       uuid,
  p_vendor_name     text,
  p_village_id      text,
  p_village         text,
  p_payment_method  text,
  p_subtotal        numeric,
  p_delivery_fee    numeric,
  p_platform_fee    numeric,
  p_total           numeric,
  p_items           jsonb,          -- [{name, qty, price, product_id?}]
  p_delivery_address text default null,
  p_use_credit      boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order_id      uuid;
  v_order_number  text;
  v_item          jsonb;
  v_result        jsonb;
begin
  -- Generate order number: SETU-YYYY-XXXX
  v_order_id     := gen_random_uuid();
  v_order_number := 'SETU-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(( select count(*) + 1 from orders )::text, 4, '0');

  -- Insert order
  insert into orders (
    id, order_number, customer_id, customer_name,
    vendor_id, vendor_name, village_id, village,
    status, payment_method, payment_status,
    subtotal, delivery_fee, platform_fee, total,
    is_cod, delivery_address
  ) values (
    v_order_id, v_order_number, p_customer_id, p_customer_name,
    p_vendor_id, p_vendor_name, p_village_id, p_village,
    'pending', p_payment_method,
    case when p_payment_method = 'COD' then 'pending' else 'paid' end,
    p_subtotal, p_delivery_fee, p_platform_fee, p_total,
    p_payment_method = 'COD', p_delivery_address
  );

  -- Insert order items
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, product_id, name, qty, price)
    values (
      v_order_id,
      case when (v_item->>'product_id') is not null
           then (v_item->>'product_id')::uuid
           else null end,
      v_item->>'name',
      (v_item->>'qty')::integer,
      (v_item->>'price')::numeric
    );

    -- Decrement product stock
    if (v_item->>'product_id') is not null then
      update products
      set stock = greatest(0, stock - (v_item->>'qty')::integer)
      where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  -- Log to audit
  insert into audit_log (actor_id, actor, action, target, detail)
  values (p_customer_id, p_customer_name, 'order_placed', v_order_number,
          'Total: ₹' || p_total);

  -- Return created order as JSON
  select to_jsonb(o.*) into v_result
  from orders o where o.id = v_order_id;

  return v_result;
end;
$$;

-- ── update_order_status ───────────────────────────────────
-- Safe status transition with validation and timestamps.
create or replace function update_order_status(
  p_order_id  uuid,
  p_new_status text,
  p_actor_id   uuid default null,
  p_meta       jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order     orders%rowtype;
  v_allowed   text[];
  v_ts_col    text;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  -- Validate transition
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
      'error', 'Invalid status transition: ' || v_order.status || ' → ' || p_new_status
    );
  end if;

  -- Determine timestamp column
  v_ts_col := case p_new_status
    when 'confirmed'  then 'confirmed_at'
    when 'ready'      then 'ready_at'
    when 'picked_up'  then 'picked_up_at'
    when 'delivered'  then 'delivered_at'
    when 'cancelled'  then 'cancelled_at'
    else null
  end;

  -- Update order
  update orders set
    status       = p_new_status,
    updated_at   = now(),
    confirmed_at  = case when p_new_status = 'confirmed'  then now() else confirmed_at  end,
    ready_at      = case when p_new_status = 'ready'      then now() else ready_at      end,
    picked_up_at  = case when p_new_status = 'picked_up'  then now() else picked_up_at  end,
    delivered_at  = case when p_new_status = 'delivered'  then now() else delivered_at  end,
    cancelled_at  = case when p_new_status = 'cancelled'  then now() else cancelled_at  end,
    cancel_reason = coalesce(p_meta->>'cancel_reason', cancel_reason),
    rider_id      = coalesce((p_meta->>'rider_id')::uuid, rider_id),
    rider_name    = coalesce(p_meta->>'rider_name', rider_name)
  where id = p_order_id;

  -- If delivered, update rider stats
  if p_new_status = 'delivered' and v_order.rider_id is not null then
    update riders set
      today_deliveries = today_deliveries + 1,
      total_deliveries = total_deliveries + 1,
      today_earnings   = today_earnings + 80,
      total_earnings   = total_earnings + 80,
      cod_balance      = case when v_order.is_cod
                              then cod_balance + v_order.total
                              else cod_balance end
    where id = v_order.rider_id;
  end if;

  -- Log to audit
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

-- ── rate_order ────────────────────────────────────────────
create or replace function rate_order(
  p_order_id      uuid,
  p_vendor_rating integer,
  p_rider_rating  integer default null,
  p_comment       text    default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  update orders set
    vendor_rating  = p_vendor_rating,
    rider_rating   = p_rider_rating,
    rating_comment = p_comment,
    is_rated       = true,
    updated_at     = now()
  where id = p_order_id and customer_id = auth.uid();

  if not found then
    return jsonb_build_object('error', 'Order not found or unauthorized');
  end if;

  -- Update vendor rating (rolling average approximation)
  update vendors v set
    rating = (v.rating * v.review_count + p_vendor_rating) / (v.review_count + 1),
    review_count = v.review_count + 1
  from orders o
  where o.id = p_order_id and o.vendor_id = v.id;

  return jsonb_build_object('success', true);
end;
$$;

-- ── topup_wallet ──────────────────────────────────────────
create or replace function topup_wallet(
  p_user_id   uuid,
  p_amount    numeric,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_wallet_id uuid;
begin
  -- Upsert wallet
  insert into wallets (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance    = wallets.balance + excluded.balance,
        updated_at = now()
  returning id into v_wallet_id;

  -- Record transaction
  insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
  values (v_wallet_id, p_user_id, 'credit', p_amount, 'Wallet top-up', p_reference, 'completed');

  return jsonb_build_object(
    'success', true,
    'new_balance', (select balance from wallets where user_id = p_user_id)
  );
end;
$$;

-- ── get_vendor_orders_with_items ──────────────────────────
-- Returns orders with nested items for a vendor.
create or replace function get_vendor_orders(p_vendor_id uuid)
returns table (
  id            uuid,
  order_number  text,
  customer_name text,
  village       text,
  status        text,
  payment_method text,
  payment_status text,
  total         numeric,
  is_cod        boolean,
  rider_name    text,
  created_at    timestamptz,
  items         jsonb
)
language sql
security definer
stable
as $$
  select
    o.id, o.order_number, o.customer_name, o.village,
    o.status, o.payment_method, o.payment_status,
    o.total, o.is_cod, o.rider_name, o.created_at,
    coalesce(
      jsonb_agg(jsonb_build_object(
        'name', oi.name, 'qty', oi.qty, 'price', oi.price
      )) filter (where oi.id is not null),
      '[]'
    ) as items
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.vendor_id = p_vendor_id
  group by o.id
  order by o.created_at desc;
$$;
