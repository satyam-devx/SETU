-- ═══════════════════════════════════════════════════════════════════════
-- SETU — Migration 089: Correct UPI cancellation refund path
--
-- Previous behaviour treated paid UPI orders like wallet payments and
-- credited the customer's SETU wallet. That is not a Razorpay refund.
-- This migration makes the distinction explicit:
--   wallet  → immediate wallet refund
--   UPI     → durable Razorpay refund request (processed by Edge Function)
--   COD collected → manual refund
--
-- The order row remains locked for the whole decision, so a concurrent
-- Razorpay capture observes either the pre-cancel pending state or the
-- committed cancelled state. The webhook then creates/continues the same
-- Razorpay refund request without crediting vendor escrow.
-- ═══════════════════════════════════════════════════════════════════════

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

  update orders set
    status = 'cancelled',
    cancel_reason = coalesce(p_reason, cancel_reason),
    cancelled_at = now(),
    updated_at = now()
  where id = p_order_id;

  -- Restore stock that create_order decremented. The Phase 2 reservation
  -- model will replace this with explicit reservation release.
  update products p
     set stock = p.stock + oi.qty,
         updated_at = now()
    from order_items oi
   where oi.order_id = p_order_id
     and oi.product_id = p.id;

  -- Only money that was actually captured is refundable here.
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
      );

    elsif v_order.payment_method = 'UPI' then
      -- IMPORTANT: a Razorpay capture must be refunded through Razorpay,
      -- never by minting SETU wallet balance. The actual provider call is
      -- intentionally outside Postgres and is performed by the
      -- process-order-refund Edge Function.
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
        requested_at = coalesce(order_refunds.requested_at, excluded.requested_at),
        status = case when order_refunds.status = 'completed' then order_refunds.status else 'pending' end,
        updated_at = now();

      update payment_intents set status = 'refund_pending', updated_at = now()
       where order_id = p_order_id
         and provider_payment_id = v_payment_id
         and status <> 'refunded';

      -- Do NOT change payment_status to refunded until Razorpay confirms it.

    elsif v_order.payment_method = 'COD' and v_order.payment_status = 'collected' then
      v_refund_method := 'manual';

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
    'success', true,
    'order_id', p_order_id,
    'refund_amount', v_refund_amount,
    'refund_method', v_refund_method,
    'refund_pending', (v_refund_method = 'razorpay')
  );
end;
$$;

grant execute on function cancel_order_with_refund(uuid, uuid, text, text) to authenticated;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'security_migration', 'cancel_order_with_refund', 'payment',
  'migration_089: paid UPI cancellations now create a durable Razorpay refund request instead of incorrectly crediting SETU wallet; wallet payments still refund to wallet; order remains payment=paid until Razorpay refund completion.'
);
