-- ═══════════════════════════════════════════════════════════════
-- Migration 055 (PASS 5 — P2 full audit of cancel_order_with_refund;
-- discovered issue, tagged PASS-5-DISCOVERED per audit instructions)
--
-- PROBLEM (found during the Pass 5 required full trace of this
-- function; not previously flagged in Pass 1-4)
-- cancel_order_with_refund() reads the order with a plain
-- `select * into v_order from orders where id = p_order_id` — no
-- row lock. It then checks v_order.status against the cancellable
-- list, and only AFTER that check does it run
-- `update orders set status = 'cancelled' ... where id = p_order_id`
-- — with no `and status = any(cancellable)` guard in that UPDATE's
-- WHERE clause (unlike, for example, pay_from_wallet's conditional
-- `where balance >= p_amount`).
--
-- Under READ COMMITTED, two concurrent cancellation attempts on the
-- same order (e.g. a double-tap on "Cancel", or a customer and an
-- admin cancelling at the same moment) can both read the order while
-- it is still in a cancellable status, both pass the status check,
-- and both proceed — the second call's UPDATE blocks on the first's
-- row lock, then succeeds once the first commits, and the second call
-- still executes its own refund logic (a second credit_wallet() call
-- and a second order_refunds insert), because nothing re-checks the
-- order's status after the row lock is actually acquired. Net effect:
-- a genuine double-refund is possible for UPI/wallet-paid orders.
--
-- FIX
-- Take the row lock up front (`for update`), using the same,
-- already-established idiom this codebase uses for this exact class
-- of problem elsewhere (claim_order, migration 050). Because `select
-- ... for update` blocks until any concurrent transaction holding the
-- lock commits or rolls back, and then returns the CURRENT
-- (post-commit) row, the existing status check below the lock now
-- correctly sees the order as already 'cancelled' on the second call
-- and rejects it — no other logic needs to change.
--
-- Everything else in this function (authorization, refund-amount
-- source, payment-method branching, audit logging) was traced in full
-- during this pass and found correct — see the PASS 5 report for the
-- complete verification notes. Only the locking line changes here.
-- ═══════════════════════════════════════════════════════════════

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

  -- PASS 5 FIX: lock the order row now, before deciding anything.
  -- A concurrent cancel attempt on the same order will block here
  -- until this transaction commits or rolls back, then see the
  -- already-'cancelled' status and be correctly rejected below —
  -- closing the double-refund race described above.
  select * into v_order from orders where id = p_order_id for update;
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

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'orders,order_refunds,cancel_order_with_refund',
  'migration_055 (PASS 5, discovered during P2 full audit): cancel_order_with_refund now takes SELECT...FOR UPDATE on the order row before checking its status, closing a race where two concurrent cancel attempts on the same order could both pass the cancellable-status check and both trigger a refund (double-refund for UPI/wallet-paid orders). No other logic in the function changed.'
);
