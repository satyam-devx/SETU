-- ═══════════════════════════════════════════════════════════════
-- Migration 050: order write-path lockdown + rider claim / admin assign
--
-- PROBLEM (security + broken features)
-- The orders table had three client UPDATE policies that gate *rows* but
-- not *columns* (RLS can't restrict columns):
--   • orders_rider_update    — using(rider_id is mine), NO status limit.
--   • orders_vendor_update   — using(my vendor, status pending..ready).
--   • orders_customer_cancel — using(mine, status pending/confirmed).
-- Because they're column-unrestricted, a client could `.update()` ANY
-- column on a qualifying row, bypassing the role-aware state machine in
-- update_order_status (017/019). Worst case: an assigned rider directly
-- sets status='delivered', skipping the cod_balance debit — i.e. pockets
-- COD cash with no liability recorded.
--
-- The same rider policy also can't match rider_id IS NULL, so the rider
-- "accept order" flow (a direct update that set rider_id on an unassigned
-- 'ready' order) was silently blocked by RLS — a broken feature.
--
-- FIX
-- Route every order write through a SECURITY DEFINER RPC and drop the
-- client UPDATE policies. After this migration the only ways to change an
-- order are:
--   • update_order_status      — role-aware status transitions (017/019)
--   • cancel_order_with_refund — atomic customer/admin cancel (017)
--   • rate_order               — customer rates own delivered order
--   • claim_order              — rider claims an unassigned 'ready' order
--   • admin_assign_rider       — admin assigns a rider
--   • orders_admin_all         — admins (is_admin) keep full access
-- All are SECURITY DEFINER and bypass RLS, so dropping the client UPDATE
-- policies removes direct-update tampering without breaking any flow.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. rider claims an unassigned, ready order ──────────────────
create or replace function claim_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_rider riders%rowtype;
  v_order orders%rowtype;
begin
  if v_uid is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_rider from riders where user_id = v_uid;
  if not found then
    raise exception 'Not a registered rider';
  end if;
  if not v_rider.is_active then
    raise exception 'Rider account is not active';
  end if;

  -- Lock the row so two riders can't claim the same order.
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.rider_id is not null then
    raise exception 'Order already assigned';
  end if;
  if v_order.status <> 'ready' then
    raise exception 'Order is not ready for pickup';
  end if;

  update orders set
    rider_id     = v_rider.id,
    rider_name   = v_rider.name,
    status       = 'picked_up',
    picked_up_at = now(),
    updated_at   = now()
  where id = p_order_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (v_uid, v_rider.name, 'order_claimed', v_order.order_number,
          format('Rider %s claimed order %s', v_rider.name, v_order.order_number));

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'status', 'picked_up');
end;
$$;
grant execute on function claim_order(uuid) to authenticated;

-- ── 2. admin assigns a rider to an order ────────────────────────
create or replace function admin_assign_rider(p_order_id uuid, p_rider_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider riders%rowtype;
  v_order orders%rowtype;
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin required';
  end if;

  select * into v_rider from riders where id = p_rider_id;
  if not found then
    raise exception 'Rider not found';
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  update orders set
    rider_id     = p_rider_id,
    rider_name   = v_rider.name,
    status       = case when v_order.status = 'pending' then 'confirmed' else v_order.status end,
    confirmed_at = case when v_order.status = 'pending' then now() else confirmed_at end,
    updated_at   = now()
  where id = p_order_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), 'admin', 'admin_assign_rider', p_order_id::text, 'order',
          format('Assigned rider %s to order %s', v_rider.name, v_order.order_number));

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'rider_id', p_rider_id);
end;
$$;
grant execute on function admin_assign_rider(uuid, uuid) to authenticated;

-- ── 3. harden existing rate_order: add search_path (was missing) ─
create or replace function rate_order(
  p_order_id      uuid,
  p_vendor_rating integer,
  p_rider_rating  integer default null,
  p_comment       text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  update vendors v set
    rating       = (v.rating * v.review_count + p_vendor_rating) / (v.review_count + 1),
    review_count = v.review_count + 1
  from orders o
  where o.id = p_order_id and o.vendor_id = v.id;

  return jsonb_build_object('success', true);
end;
$$;
grant execute on function rate_order(uuid, integer, integer, text) to authenticated;

-- ── 4. drop the column-unrestricted client UPDATE policies ──────
-- Every legitimate write now goes through a SECURITY DEFINER RPC above.
drop policy if exists "orders_rider_update"    on orders;
drop policy if exists "orders_vendor_update"   on orders;
drop policy if exists "orders_customer_cancel" on orders;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'security_migration', 'orders', 'table',
  'migration_050: order write-path lockdown — dropped column-unrestricted client UPDATE policies (rider/vendor/customer); all order writes now via SECURITY DEFINER RPCs (update_order_status, cancel_order_with_refund, rate_order, claim_order, admin_assign_rider). Closes COD-evasion via direct rider update; fixes broken rider-accept and rating flows.'
);
