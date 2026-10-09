-- ═══════════════════════════════════════════════════════════════
-- Migration 103 — AUDIT REMEDIATION (payments / credit / grants)
--
-- Static audit findings fixed here (see AUDIT_REPORT.md):
--
--  F-01 [CRITICAL] finalize_order_financial_capture() (migration 094)
--       selects credit_transactions.reference, a column that no
--       migration ever created. The function's handler only catches
--       undefined_table, so undefined_column (42703) propagates and the
--       function raises on EVERY call. It is invoked by the Razorpay
--       webhook after each captured order payment and by the wallet
--       payment trigger. Fix: use the column that actually carries the
--       order link ('Order discount <order_number>' in `purpose`, as
--       written by create_order), and add the missing `reference`
--       column (needed by F-02) so both are safe either way.
--
--  F-02 [HIGH] Webhook wallet top-up / credit repayment were not
--       idempotent: topup_wallet() has no per-payment guard, so a
--       webhook retry after a late failure credited the wallet again;
--       credit repayment did read-modify-write outside a transaction and
--       re-reduced `outstanding` on each retry (its audit insert also
--       targeted the non-existent `reference` column, so every attempt
--       "failed" and was retried up to 5x). Identity/amount were taken
--       from Razorpay payment notes instead of the server-written
--       payment_orders row. Fix: two service-role-only RPCs that lock
--       the payment_orders row, verify type + amount, and apply the
--       credit exactly once.
--
--  F-03 [HIGH] "service-role only" RPCs locked with
--       `REVOKE ... FROM authenticated, anon` are still executable via
--       PUBLIC (see migration 035's own root-cause note). Re-applies the
--       correct lockdown to: process_dispatch_timeouts,
--       dispatch_ready_order, _dispatch_offer_next_batch,
--       check_rate_limit, prune_*, refresh_admin_dashboard_stats.
--       check_rate_limit being open to anon let anyone burn another
--       user's rate-limit bucket (payment / KYC / AI lockout).
--
--  F-04 [MEDIUM] get_live_admin_analytics() (migration 011) is
--       SECURITY DEFINER with no admin check and is PUBLIC-executable.
--       It currently errors (references profiles.credit_outstanding and
--       vendors.cod_deposit_amount, which do not exist) so nothing is
--       leaking today, but it is one column-fix away from exposing
--       platform GMV/revenue to anon. The client already falls back to
--       the is_admin()-gated get_admin_analytics_snapshot() on error, so
--       locking it is behaviour-neutral.
--
-- Idempotent: every statement is IF NOT EXISTS / CREATE OR REPLACE /
-- guarded by pg_proc lookups.
-- ═══════════════════════════════════════════════════════════════

-- ── F-01a: add the column 094 expects (additive, nullable) ──────
alter table credit_transactions add column if not exists reference text;

-- One repayment row per gateway payment id → hard idempotency anchor.
create unique index if not exists uq_credit_txn_repayment_reference
  on credit_transactions (reference)
  where type = 'repayment' and reference is not null;

-- ── F-01b: fix the broken lookup in the ledger finalizer ────────
create or replace function finalize_order_financial_capture(
  p_order_id uuid,
  p_payment_id text default null,
  p_gateway_fee numeric default 0
)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare
  o orders%rowtype;
  s delivery_fee_splits%rowtype;
  v_credit numeric := 0;
  v_discount numeric;
  v_subsidy numeric;
  v_platform_adjustment numeric;
  v_customer_paid numeric;
  v_journal uuid;
begin
  select * into o from orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  select * into s from delivery_fee_splits where order_id=p_order_id;
  if not found then raise exception 'Financial split missing for order %', p_order_id; end if;

  begin
    select coalesce(sum(ct.amount),0) into v_credit from credit_transactions ct where ct.purpose = 'Order discount ' || o.order_number and ct.type='disbursement';
  exception when undefined_table then v_credit := 0;
  end;
  v_discount := greatest(0, coalesce(o.subtotal,0) - greatest(0, coalesce(o.total,0) - coalesce(o.delivery_fee,0) - coalesce(o.platform_fee,0)));
  v_customer_paid := o.total;
  -- Obligations in the existing SETU split can exceed customer cash because SETU
  -- may subsidize discounts and the fixed rider fee. Record that gap explicitly.
  v_subsidy := greatest(0, s.vendor_amount + s.rider_earning + s.platform_cut - v_customer_paid);
  v_platform_adjustment := greatest(0, v_customer_paid - (s.vendor_amount + s.rider_earning + s.platform_cut));

  insert into order_financials(
    order_id,gross_merchandise,coupon_discount,credit_discount,total_discount,
    delivery_fee,platform_commission,customer_paid,vendor_payable,rider_payable,
    gateway_fee,platform_subsidy,cod_liability,updated_at
  ) values(
    o.id,o.subtotal,coalesce(o.coupon_discount,0),v_credit,v_discount,
    o.delivery_fee,o.platform_fee,v_customer_paid,s.vendor_amount,s.rider_earning,
    greatest(0,p_gateway_fee),v_subsidy,case when o.is_cod then o.total else 0 end,now()
  ) on conflict(order_id) do update set
    gateway_fee=greatest(order_financials.gateway_fee,excluded.gateway_fee),
    platform_subsidy=excluded.platform_subsidy,
    cod_liability=excluded.cod_liability,
    updated_at=now();

  v_journal := post_balanced_journal(
    'order_capture',o.id,'payment',coalesce(p_payment_id,o.order_number),
    'order-capture:'||o.id::text,
    'Order capture allocation',
    jsonb_build_array(
      jsonb_build_object('account_code','payment_clearing','debit',o.total,'credit',0,'entity_id',o.customer_id,'memo','Customer payment'),
      jsonb_build_object('account_code','vendor_payable','debit',0,'credit',s.vendor_amount,'entity_id',o.vendor_id,'memo','Vendor payable'),
      jsonb_build_object('account_code','rider_payable','debit',0,'credit',s.rider_earning,'entity_id',o.rider_id,'memo','Rider delivery payable'),
      jsonb_build_object('account_code','platform_commission','debit',0,'credit',s.platform_cut,'entity_id',null,'memo','Platform commission'),
      jsonb_build_object('account_code','discount_subsidy','debit',v_subsidy,'credit',0,'entity_id',null,'memo','Platform-funded discount/subsidy'),
      jsonb_build_object('account_code','platform_adjustment','debit',0,'credit',v_platform_adjustment,'entity_id',null,'memo','Residual platform adjustment')
    )
  );

  if p_gateway_fee > 0 then
    perform post_balanced_journal('gateway_fee',o.id,'payment',coalesce(p_payment_id,o.order_number),
      'gateway-fee:'||o.id::text,'Gateway processing fee',jsonb_build_array(
        jsonb_build_object('account_code','gateway_fee','debit',p_gateway_fee,'credit',0,'entity_id',null,'memo','Gateway fee'),
        jsonb_build_object('account_code','payment_clearing','debit',0,'credit',p_gateway_fee,'entity_id',o.customer_id,'memo','Gateway fee deducted from clearing')
      ));
  end if;
  return jsonb_build_object('success',true,'journal_id',v_journal,'vendor_payable',s.vendor_amount,'rider_payable',s.rider_earning,'platform_commission',s.platform_cut,'discount_subsidy',v_subsidy,'gateway_fee',greatest(0,p_gateway_fee));
end;
$$;

-- ── F-02: exactly-once wallet top-up from a verified capture ────
-- Called ONLY by the razorpay-webhook edge function (service role)
-- after HMAC verification. Identity and expected amount come from the
-- server-written payment_orders row, never from payment notes.
create or replace function apply_wallet_topup_payment(
  p_razorpay_order_id text,
  p_payment_id        text,
  p_amount            numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po    payment_orders%rowtype;
  v_topup wallet_topups%rowtype;
begin
  if coalesce(p_razorpay_order_id, '') = '' or coalesce(p_payment_id, '') = ''
     or p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_arguments');
  end if;

  -- Serialises concurrent duplicate deliveries of the same capture.
  select * into v_po from payment_orders
   where razorpay_order_id = p_razorpay_order_id
   for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'unknown_payment_order', 'manual_review', true);
  end if;
  if coalesce(v_po.notes ->> 'type', '') <> 'wallet_topup' or v_po.user_id is null then
    return jsonb_build_object('success', false, 'error', 'payment_order_type_mismatch', 'manual_review', true);
  end if;
  if round(v_po.amount, 2) <> round(p_amount, 2) then
    return jsonb_build_object('success', false, 'error', 'amount_mismatch', 'manual_review', true,
                              'expected', v_po.amount, 'captured', p_amount);
  end if;

  insert into wallet_topups (user_id, amount, payment_id, razorpay_order_id, status)
  values (v_po.user_id, v_po.amount, p_payment_id, p_razorpay_order_id, 'pending')
  on conflict (razorpay_order_id) do nothing;

  select * into v_topup from wallet_topups
   where razorpay_order_id = p_razorpay_order_id
   for update;

  if v_topup.status = 'completed' then
    return jsonb_build_object('success', true, 'already_applied', true);
  end if;

  perform topup_wallet(v_po.user_id, v_po.amount, p_payment_id);

  update wallet_topups
     set status = 'completed', payment_id = p_payment_id, updated_at = now()
   where id = v_topup.id;

  return jsonb_build_object('success', true, 'already_applied', false,
                            'user_id', v_po.user_id, 'amount', v_po.amount);
end;
$$;

-- ── F-02: exactly-once SETU Credit repayment from a capture ─────
-- Reduces outstanding by min(outstanding, paid). Any surplus is
-- credited to the customer's wallet so paid money is never silently
-- swallowed (product decision to confirm — see AUDIT_REPORT.md).
create or replace function apply_credit_repayment_payment(
  p_razorpay_order_id text,
  p_payment_id        text,
  p_amount            numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po      payment_orders%rowtype;
  v_acct    credit_accounts%rowtype;
  v_apply   numeric(12,2);
  v_surplus numeric(12,2);
begin
  if coalesce(p_razorpay_order_id, '') = '' or coalesce(p_payment_id, '') = ''
     or p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'invalid_arguments');
  end if;

  select * into v_po from payment_orders
   where razorpay_order_id = p_razorpay_order_id
   for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'unknown_payment_order', 'manual_review', true);
  end if;
  if coalesce(v_po.notes ->> 'type', '') <> 'credit_repayment' or v_po.user_id is null then
    return jsonb_build_object('success', false, 'error', 'payment_order_type_mismatch', 'manual_review', true);
  end if;
  if round(v_po.amount, 2) <> round(p_amount, 2) then
    return jsonb_build_object('success', false, 'error', 'amount_mismatch', 'manual_review', true,
                              'expected', v_po.amount, 'captured', p_amount);
  end if;

  select * into v_acct from credit_accounts where user_id = v_po.user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'no_credit_account', 'manual_review', true);
  end if;

  if exists (select 1 from credit_transactions
              where type = 'repayment' and reference = p_payment_id) then
    return jsonb_build_object('success', true, 'already_applied', true);
  end if;

  v_apply   := least(v_acct.outstanding, v_po.amount);
  v_surplus := v_po.amount - v_apply;

  if v_apply > 0 then
    update credit_accounts
       set outstanding = outstanding - v_apply, updated_at = now()
     where id = v_acct.id;
  end if;

  insert into credit_transactions (account_id, user_id, type, amount, purpose, status, reference, repaid_at)
  values (v_acct.id, v_po.user_id, 'repayment', v_po.amount,
          'Razorpay repayment', 'repaid', p_payment_id, now());

  if v_surplus > 0 then
    perform topup_wallet(v_po.user_id, v_surplus, p_payment_id || ':credit_surplus');
  end if;

  return jsonb_build_object('success', true, 'already_applied', false,
                            'applied', v_apply, 'wallet_surplus', v_surplus);
end;
$$;

-- ── F-03 / F-04: correct service-only lockdown (revoke PUBLIC) ──
do $$
declare
  r record;
  v_service_only text[] := array[
    'apply_wallet_topup_payment',
    'apply_credit_repayment_payment',
    'process_dispatch_timeouts',
    'dispatch_ready_order',
    '_dispatch_offer_next_batch',
    'check_rate_limit',
    'prune_rate_limit_hits',
    'prune_old_notifications',
    'prune_old_payment_events',
    'prune_client_error_logs',
    'refresh_admin_dashboard_stats',
    'get_live_admin_analytics'
  ];
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (v_service_only)
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'audit_remediation_103',
  'migration_103: fixed finalize_order_financial_capture (missing credit_transactions.reference), added idempotent apply_wallet_topup_payment / apply_credit_repayment_payment, and revoked PUBLIC EXECUTE on service-only RPCs (dispatch workers, check_rate_limit, prune_*, get_live_admin_analytics).'
);
