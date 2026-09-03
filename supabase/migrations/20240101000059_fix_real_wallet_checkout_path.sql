-- ═══════════════════════════════════════════════════════════════
-- Migration 059 (PASS 7 — Workstream 1): pay_order_from_wallet
--
-- PASS 6 FINDING (the highest-severity issue in the four-plus-pass
-- audit series): Pass 5's DATA-03 fix (migration 056) was applied to
-- pay_from_wallet, a function with ZERO frontend callers. The function
-- the live checkout flow actually calls — CustomerCheckout.jsx →
-- PaymentAPI.payOrderFromWallet → pay_order_from_wallet (this
-- function, originally defined in migration 017) — was never touched.
--
-- Two concrete problems, both fixed here:
--
-- 1. TOCTOU race: the original body read the order with a plain
--    `select * into v_order from orders where id = p_order_id` — no
--    lock. Two concurrent calls for the same order could both read
--    payment_status = 'pending' before either committed.
--
-- 2. Dangerous retry semantics: a SEQUENTIAL retry (e.g. the client
--    loses the response after a successful debit on a slow/dropped
--    connection — exactly SETU's target operating environment) hits
--    the original `if payment_status <> 'pending' ... return
--    {success:false, error:'Order is not awaiting payment'}` branch.
--    CustomerCheckout.jsx's generic wallet-error handling then calls
--    cancel_order_with_refund on an order that was just successfully
--    paid — an unintended cancel-and-refund of a completed purchase.
--
-- FIX
-- • `select ... for update` on the order row, BEFORE any status
--   check — the same proven idiom this codebase already uses in
--   claim_order (migration 050) and cancel_order_with_refund
--   (migration 055). A concurrent second call blocks here until the
--   first transaction commits or rolls back, then reads the
--   post-commit row — no stale-read window remains.
-- • The "already successfully paid" case is now a DISTINCT, explicit,
--   machine-readable outcome — `{success: true, already_paid: true,
--   ...}` — not a generic `{success: false, error: '...'}`. This is a
--   deliberate design decision, not an accident: any caller checking
--   `data.success` (which is exactly what PaymentAPI.payOrderFromWallet
--   already does, unchanged) will treat a same-order retry after a
--   real success as a success, never triggering cancellation.
-- • A genuinely non-payable order (e.g. cancelled before payment, or
--   any other non-pending state that ISN'T "already paid by this
--   mechanism") remains a real, distinct failure —
--   `{success: false, error: 'order_not_payable', ...}` — so a truly
--   invalid payment attempt is still correctly rejected, only the
--   "you already succeeded" case is no longer conflated with it.
-- • Concurrent-duplicate-payment protection is now PRIMARILY the
--   explicit order-row lock above (deliberate, not incidental). The
--   wallet_transactions insert is additionally wrapped in an
--   exception handler for the (now residual, defense-in-depth only —
--   not the primary mechanism) unique_violation case, converting it
--   into the same clean already_paid response instead of an unhandled
--   error, and reversing the balance deduction that transaction just
--   made so no persistent double debit can occur even in that
--   secondary path.
-- • The amount remains 100% server-derived from `v_order.total` — no
--   client-supplied amount was ever accepted here, and none is added.
-- ═══════════════════════════════════════════════════════════════

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

  -- PASS 7 FIX: lock the order row before making any decision about
  -- it. A concurrent call for the same order blocks here until this
  -- transaction commits or rolls back, then sees the current,
  -- post-commit state — closing the TOCTOU race described above.
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;
  if v_order.customer_id <> v_uid then
    return jsonb_build_object('success', false, 'error', 'Not your order');
  end if;

  -- PASS 7 FIX: "already paid" is now its own explicit, success-shaped
  -- outcome, distinct from a genuine failure. This is the case a
  -- sequential retry after a lost response hits.
  if v_order.payment_status = 'paid' then
    select id, balance into v_wallet_id, v_new_balance from wallets where user_id = v_uid;
    return jsonb_build_object(
      'success', true, 'already_paid', true,
      'new_balance', coalesce(v_new_balance, 0), 'total', v_order.total
    );
  end if;

  -- Any other non-pending state (e.g. cancelled before payment) is a
  -- genuine, distinct failure — not conflated with "already paid".
  if v_order.payment_status <> 'pending' or v_order.status <> 'pending' then
    return jsonb_build_object('success', false, 'error', 'order_not_payable',
      'message', 'This order is no longer awaiting payment.');
  end if;

  -- Atomic debit of the AUTHORITATIVE, server-recorded total, only if
  -- balance suffices. Never a client-supplied amount.
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

  -- Defense-in-depth only (the order-row lock above is the primary,
  -- deliberate protection): if some other path ever inserted a
  -- completed debit for this exact (wallet, order) pair without going
  -- through this function's own lock, the unique index from migration
  -- 056 (table-scoped, so it applies here too) will still catch it —
  -- and we now handle that explicitly and gracefully instead of
  -- letting an unhandled exception surface, reversing the balance
  -- change we just made so no double debit can persist.
  begin
    insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
    values (v_wallet_id, v_uid, 'debit', v_order.total,
            'Order payment ' || v_order.order_number, p_order_id::text, 'completed');
  exception when unique_violation then
    update wallets set balance = balance + v_order.total, updated_at = now()
     where id = v_wallet_id;
    return jsonb_build_object(
      'success', true, 'already_paid', true,
      'new_balance', (select balance from wallets where id = v_wallet_id), 'total', v_order.total
    );
  end;

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

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'orders,wallets,wallet_transactions,pay_order_from_wallet',
  'migration_059 (PASS 7, Workstream 1 — the highest-priority finding from the Pass 6 independent re-audit): pay_order_from_wallet (the function CustomerCheckout.jsx actually calls, NOT pay_from_wallet which Pass 5 fixed in error) now locks the order row before checking its status, and returns an explicit success-shaped already_paid:true result for a same-order retry after a real success, instead of a generic failure that the checkout UI would otherwise misinterpret as a reason to cancel-and-refund a just-paid order. A genuinely non-payable order (e.g. cancelled) remains a distinct, real failure. Amount remains 100% server-derived from orders.total throughout.'
);
