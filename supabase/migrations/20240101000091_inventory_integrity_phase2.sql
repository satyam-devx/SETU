-- ═══════════════════════════════════════════════════════════════════════
-- SETU — Migration 091: Phase 2 Inventory Integrity
--
-- Inventory model:
--   create_order() already decrements `products.stock` atomically.
--   Phase 2 makes that decrement an explicit reservation ledger entry.
--   A reservation is therefore backed by real stock removed from the
--   sellable pool; it is NOT an additional subtraction.
--
-- Lifecycle:
--   reserved -> committed   (payment succeeds / COD order confirmed)
--   reserved -> released    (cancel / payment timeout)
--   reserved -> expired     (expiry worker releases it)
--   committed -> released   (post-payment cancellation/restock)
--
-- The database transaction is the recovery boundary: if order creation,
-- reservation creation, payment finalisation, or release fails, all DB
-- mutations roll back together. Provider/network work stays outside the
-- transaction and is reconciled by the existing payment state machine.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists inventory_reservations (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references orders(id) on delete cascade,
  product_id        uuid not null references products(id),
  qty               integer not null check (qty > 0),
  status            text not null default 'reserved'
                    check (status in ('reserved','committed','released','expired')),
  reserved_at       timestamptz not null default now(),
  expires_at        timestamptz not null,
  committed_at      timestamptz,
  released_at       timestamptz,
  release_reason    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (order_id, product_id)
);

create index if not exists idx_inventory_reservations_expiry
  on inventory_reservations(status, expires_at)
  where status = 'reserved';
create index if not exists idx_inventory_reservations_order
  on inventory_reservations(order_id, status);
create index if not exists idx_inventory_reservations_product
  on inventory_reservations(product_id, status);

alter table inventory_reservations enable row level security;

create policy "inventory_reservations_customer_read"
  on inventory_reservations for select
  using (
    exists (
      select 1 from orders o
       where o.id = inventory_reservations.order_id
         and (o.customer_id = auth.uid() or is_admin())
    )
  );

create policy "inventory_reservations_vendor_admin_read"
  on inventory_reservations for select
  using (
    is_admin() or exists (
      select 1
        from orders o
        join vendors v on v.id = o.vendor_id
       where o.id = inventory_reservations.order_id
         and v.owner_id = auth.uid()
    )
  );

-- Only trusted RPCs / service_role may mutate the ledger.
revoke insert, update, delete on inventory_reservations from anon, authenticated;

drop trigger if exists trg_inventory_reservations_updated_at on inventory_reservations;
create trigger trg_inventory_reservations_updated_at
before update on inventory_reservations
for each row execute function set_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- Create a reservation entry for every order item.
-- Stock was already atomically decremented by create_order().
-- ───────────────────────────────────────────────────────────────────────
create or replace function create_inventory_reservation_for_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_method text;
  v_expiry timestamptz;
begin
  select payment_method into v_method from orders where id = new.order_id;

  -- Online/wallet/credit checkout attempts get a short payment hold.
  -- COD gets a longer operational hold because there is no payment timeout.
  v_expiry := now() + case
    when v_method in ('UPI','wallet','credit') then interval '15 minutes'
    else interval '24 hours'
  end;

  insert into inventory_reservations (
    order_id, product_id, qty, status, reserved_at, expires_at
  ) values (
    new.order_id, new.product_id, new.qty, 'reserved', now(), v_expiry
  )
  on conflict (order_id, product_id) do update set
    qty = inventory_reservations.qty + excluded.qty,
    expires_at = greatest(inventory_reservations.expires_at, excluded.expires_at),
    updated_at = now();

  return new;
end;
$$;

revoke all on function create_inventory_reservation_for_item() from public, anon, authenticated;
grant execute on function create_inventory_reservation_for_item() to service_role;

drop trigger if exists trg_order_item_inventory_reservation on order_items;
create trigger trg_order_item_inventory_reservation
after insert on order_items
for each row execute function create_inventory_reservation_for_item();

-- ───────────────────────────────────────────────────────────────────────
-- Release reservations and return their backed stock to products.stock.
-- Order row should normally already be locked by the caller.
-- ───────────────────────────────────────────────────────────────────────
create or replace function release_inventory_for_order(
  p_order_id uuid,
  p_reason text default 'order_cancelled'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_released integer := 0;
  v_has_reservations boolean := false;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  for v_res in
    select * from inventory_reservations
     where order_id = p_order_id
       and status in ('reserved','committed')
     order by product_id
     for update
  loop
    v_has_reservations := true;

    -- Both states represent stock that was removed from the sellable pool:
    -- reserved stock has not been committed to the sale; committed stock
    -- was already consumed by a paid order and must be restocked on cancel.
    update products
       set stock = stock + v_res.qty,
           updated_at = now()
     where id = v_res.product_id;

    update inventory_reservations
       set status = 'released',
           released_at = now(),
           release_reason = p_reason,
           updated_at = now()
     where id = v_res.id;

    v_released := v_released + v_res.qty;
  end loop;

  -- Backward compatibility for orders created before Phase 2. Such orders
  -- have no reservation ledger and still have their stock decrement owned
  -- by order_items, so preserve the old restoration behaviour exactly once.
  if not v_has_reservations then
    update products p
       set stock = p.stock + oi.qty,
           updated_at = now()
      from order_items oi
     where oi.order_id = p_order_id
       and oi.product_id = p.id;
    select coalesce(sum(qty),0)::integer into v_released
      from order_items where order_id = p_order_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'released_qty', v_released,
    'legacy_fallback', not v_has_reservations
  );
end;
$$;

revoke all on function release_inventory_for_order(uuid,text) from public, anon, authenticated;
grant execute on function release_inventory_for_order(uuid,text) to service_role;

-- ───────────────────────────────────────────────────────────────────────
-- Payment/COD success commits the reservation without subtracting stock
-- again: stock was already removed when the reservation was created.
-- ───────────────────────────────────────────────────────────────────────
create or replace function commit_inventory_for_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_expired integer := 0;
begin
  if auth.role() <> 'service_role' and auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  with changed as (
    update inventory_reservations
       set status = 'committed',
           committed_at = coalesce(committed_at, now()),
           updated_at = now()
     where order_id = p_order_id
       and status = 'reserved'
    returning 1
  )
  select count(*)::integer into v_count from changed;

  select count(*) into v_expired
    from inventory_reservations
   where order_id = p_order_id
     and status = 'expired';

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'committed', coalesce(v_count,0),
    'expired', v_expired
  );
end;
$$;

revoke all on function commit_inventory_for_order(uuid) from public, anon, authenticated;
grant execute on function commit_inventory_for_order(uuid) to service_role;

-- Automatically commit whenever the authoritative payment/order transition
-- reaches paid/collected. This covers Razorpay capture and wallet payment.
create or replace function trg_commit_inventory_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status in ('paid','collected')
     and old.payment_status is distinct from new.payment_status then
    perform commit_inventory_for_order(new.id);
  end if;
  return new;
end;
$$;

revoke all on function trg_commit_inventory_on_payment() from public, anon, authenticated;
grant execute on function trg_commit_inventory_on_payment() to service_role;

drop trigger if exists trg_orders_commit_inventory on orders;
create trigger trg_orders_commit_inventory
after update of payment_status on orders
for each row execute function trg_commit_inventory_on_payment();

-- Any legitimate order-status path that changes an order to cancelled must
-- release its reservation. cancel_order_with_refund() and the timeout worker
-- already perform the release themselves, so they set a transaction-local
-- guard to prevent this trigger from releasing the same stock twice.
create or replace function trg_release_inventory_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled'
     and old.status is distinct from new.status
     and coalesce(current_setting('setu.inventory_release_done', true), '0') <> '1' then
    perform release_inventory_for_order(new.id, coalesce(new.cancel_reason, 'order_cancelled'));
  end if;
  return new;
end;
$$;

revoke all on function trg_release_inventory_on_cancel() from public, anon, authenticated;
grant execute on function trg_release_inventory_on_cancel() to service_role;

drop trigger if exists trg_orders_release_inventory_on_cancel on orders;
create trigger trg_orders_release_inventory_on_cancel
after update of status on orders
for each row execute function trg_release_inventory_on_cancel();

-- ───────────────────────────────────────────────────────────────────────
-- Payment timeout / expiry worker.
-- Locks each order before releasing inventory, so capture-vs-timeout and
-- cancel-vs-timeout races resolve to exactly one terminal outcome.
-- ───────────────────────────────────────────────────────────────────────
create or replace function expire_stale_inventory_reservations(
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
  v_order orders%rowtype;
  v_expired integer := 0;
  v_orders integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Unauthorized: service_role required';
  end if;

  for v_res in
    select id, order_id
      from inventory_reservations
     where status = 'reserved'
       and expires_at <= now()
     order by expires_at
     limit greatest(1, least(p_limit, 500))
     for update skip locked
  loop
    -- Re-check the authoritative order state under lock. A payment capture
    -- or customer cancellation that won the order lock gets to finish first.
    select * into v_order from orders where id = v_res.order_id for update;
    if not found then
      continue;
    end if;

    if v_order.status = 'pending' and v_order.payment_status = 'pending' then
      perform release_inventory_for_order(v_order.id, 'payment_timeout');

      perform set_config('setu.inventory_release_done', '1', true);
      perform _set_internal_payment_flag();
      update orders set
        status = 'cancelled',
        cancel_reason = 'Payment timeout',
        cancelled_at = now(),
        updated_at = now()
      where id = v_order.id and status = 'pending' and payment_status = 'pending';

      update payment_intents
         set status = case when status in ('created','checkout_open','payment_pending') then 'cancelled' else status end,
             updated_at = now()
       where order_id = v_order.id
         and status in ('created','checkout_open','payment_pending');

      update inventory_reservations
         set status = 'expired',
             released_at = coalesce(released_at, now()),
             release_reason = 'payment_timeout',
             updated_at = now()
       where order_id = v_order.id and status = 'released';

      v_expired := v_expired + 1;
      v_orders := v_orders + 1;
    end if;
  end loop;

  return jsonb_build_object('success', true, 'expired_reservations', v_expired, 'cancelled_orders', v_orders);
end;
$$;

revoke all on function expire_stale_inventory_reservations(integer) from public, anon, authenticated;
grant execute on function expire_stale_inventory_reservations(integer) to service_role;

-- Run every minute. The function is service_role-only and uses SKIP LOCKED,
-- so multiple workers can safely coexist without double release.
-- cron.schedule() is a function, not an INSERT, so explicitly replace an
-- existing job name before creating the canonical schedule.
do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'expire-setu-inventory-reservations';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'expire-setu-inventory-reservations',
    '* * * * *',
    'select expire_stale_inventory_reservations(100);'
  );
end $$;

-- ───────────────────────────────────────────────────────────────────────
-- Replace cancellation so inventory release is part of the same DB
-- transaction as the cancellation decision. Paid UPI still creates the
-- Phase 1 Razorpay refund request; no provider call occurs in Postgres.
-- ───────────────────────────────────────────────────────────────────────
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
  v_uid             uuid := auth.uid();
  v_role            text;
  v_order           orders%rowtype;
  v_refund_amount   numeric := 0;
  v_refund_method   text;
  v_cancellable     text[] := array['pending','confirmed','preparing'];
  v_wallet_result   jsonb;
  v_is_backend      boolean := (auth.uid() is null);
  v_authorized      boolean := false;
  v_payment_id      text;
  v_inventory       jsonb;
begin
  perform _set_internal_payment_flag();

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

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

  perform set_config('setu.inventory_release_done', '1', true);
  update orders set
    status = 'cancelled',
    cancel_reason = coalesce(p_reason, cancel_reason),
    cancelled_at = now(),
    updated_at = now()
  where id = p_order_id;

  -- Release the reservation ledger. For a paid/confirmed order this also
  -- restocks the committed quantity; for an unpaid order it merely returns
  -- the held stock to the sellable pool.
  v_inventory := release_inventory_for_order(p_order_id, coalesce(p_reason, 'order_cancelled'));

  if v_order.payment_status in ('paid', 'collected') then
    v_refund_amount := v_order.total;

    if v_order.payment_method = 'wallet' then
      v_refund_method := 'wallet';
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
      )
      on conflict (order_id) do update set
        status = 'completed', completed_at = now(), updated_at = now();

    elsif v_order.payment_method = 'UPI' then
      v_refund_method := 'razorpay';

      select provider_payment_id into v_payment_id
        from payment_transactions
       where order_id = p_order_id
         and status in ('captured','reconciliation_required')
       order by captured_at desc nulls last, created_at desc
       limit 1;

      insert into order_refunds (
        order_id, customer_id, refund_amount, refund_method,
        status, razorpay_payment_id, requested_at, cancel_reason, initiated_by
      ) values (
        p_order_id, v_order.customer_id, v_refund_amount, 'razorpay',
        'pending', v_payment_id, now(), p_reason, coalesce(v_uid, p_actor_id)
      )
      on conflict (order_id) do update set
        refund_amount = excluded.refund_amount,
        refund_method = 'razorpay',
        razorpay_payment_id = coalesce(order_refunds.razorpay_payment_id, excluded.razorpay_payment_id),
        cancel_reason = coalesce(excluded.cancel_reason, order_refunds.cancel_reason),
        requested_at = coalesce(order_refunds.requested_at, order_refunds.requested_at),
        status = case when order_refunds.status = 'completed' then order_refunds.status else 'pending' end,
        updated_at = now();

      update payment_intents set status = 'refund_pending', updated_at = now()
       where order_id = p_order_id
         and provider_payment_id = v_payment_id
         and status <> 'refunded';

    elsif v_order.payment_method = 'COD' and v_order.payment_status = 'collected' then
      v_refund_method := 'manual';
      insert into order_refunds (
        order_id, customer_id, refund_amount, refund_method,
        status, cancel_reason, initiated_by
      ) values (
        p_order_id, v_order.customer_id, v_refund_amount, 'manual',
        'pending', p_reason, coalesce(v_uid, p_actor_id)
      )
      on conflict (order_id) do update set updated_at = now();
    end if;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    coalesce(v_uid, p_actor_id),
    coalesce((select name from profiles where id = v_uid), coalesce(v_role, 'backend')),
    'order_cancelled', v_order.order_number,
    format('Reason: %s | Refund: ₹%s via %s | Inventory: %s',
           coalesce(p_reason, 'not specified'), v_refund_amount,
           coalesce(v_refund_method, 'none'), v_inventory->>'released_qty')
  );

  return jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'refund_amount', v_refund_amount,
    'refund_method', v_refund_method,
    'refund_pending', (v_refund_method = 'razorpay'),
    'inventory', v_inventory
  );
end;
$$;

grant execute on function cancel_order_with_refund(uuid, uuid, text, text) to authenticated;
grant execute on function cancel_order_with_refund(uuid, uuid, text, text) to service_role;

-- Backfill reservation rows for currently pending/active orders created before
-- the trigger existed. We can only safely backfill orders whose stock was
-- already decremented by the canonical create_order path. Legacy/manual
-- orders are left untouched rather than guessing their inventory history.
insert into inventory_reservations (order_id, product_id, qty, status, reserved_at, expires_at)
select oi.order_id,
       oi.product_id,
       sum(oi.qty)::integer,
       case when o.payment_status in ('paid','collected') then 'committed' else 'reserved' end,
       min(o.created_at),
       case when o.payment_status in ('paid','collected') then now()
            when o.payment_method in ('UPI','wallet','credit') then o.created_at + interval '15 minutes'
            else o.created_at + interval '24 hours' end
  from order_items oi
  join orders o on o.id = oi.order_id
 where not exists (select 1 from inventory_reservations ir where ir.order_id = oi.order_id)
   and o.status <> 'cancelled'
 group by oi.order_id, oi.product_id, o.payment_status, o.payment_method, o.created_at;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'inventory_reservations', 'inventory',
  'migration_091: Phase 2 inventory integrity — explicit reservation ledger, expiry/payment timeout, atomic release on cancellation, commit on payment success, legacy backfill, and concurrency-safe worker.'
);
