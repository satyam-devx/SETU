-- ═══════════════════════════════════════════════════════════════
-- Migration 018: Port remaining rider-payout functions into the
-- canonical tree (Phase 2 — migration-tree unification).
--
-- create_rider_payment_batch() and confirm_rider_payment() were the
-- last two functions that existed ONLY in the legacy
-- database/functions_phase0_payments.sql tree (which CI never deploys
-- — see migration 015's note and SECURITY_FIXES.md Part 3). With them
-- ported here, the legacy database/ tree carries nothing the deployed
-- schema lacks and can be deleted.
--
-- They operate on rider_payments (migration 008) and aggregate
-- delivery_fee_splits.rider_earning. Like the vendor-payout RPCs in
-- migration 015, they move real money and are therefore SERVICE-ROLE
-- ONLY: revoked from authenticated/anon so no logged-in user can call
-- supabase.rpc('create_rider_payment_batch', …) directly. An admin UI
-- must call them through a server-side Edge Function (the same pattern
-- as vendor-payout), never from the browser.
-- ═══════════════════════════════════════════════════════════════

-- ── create_rider_payment_batch ──────────────────────────────────
create or replace function create_rider_payment_batch(
  p_rider_id     uuid,
  p_period_start date,
  p_period_end   date,
  p_method       text    default 'bank_transfer',
  p_adjustments  numeric default 0,
  p_notes        text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gross    numeric;
  v_count    integer;
  v_net      numeric;
  v_batch_id uuid;
begin
  -- Idempotency: don't duplicate a batch for the same period.
  if exists (
    select 1 from rider_payments
    where rider_id = p_rider_id
      and period_start = p_period_start
      and period_end   = p_period_end
  ) then
    return jsonb_build_object('success', false, 'error', 'Batch already exists for this period');
  end if;

  select coalesce(sum(dfs.rider_earning), 0), count(*)
    into v_gross, v_count
  from delivery_fee_splits dfs
  join orders o on o.id = dfs.order_id
  where o.rider_id  = p_rider_id
    and o.status    = 'delivered'
    and o.delivered_at::date between p_period_start and p_period_end;

  v_net := v_gross + p_adjustments;

  if v_net <= 0 then
    return jsonb_build_object('success', false, 'error', 'No earnings to pay out for this period');
  end if;

  insert into rider_payments (
    rider_id, period_start, period_end,
    deliveries_count, gross_earnings, adjustments, net_payout,
    status, payout_method, notes
  ) values (
    p_rider_id, p_period_start, p_period_end,
    v_count, v_gross, p_adjustments, v_net,
    'pending', p_method, p_notes
  )
  returning id into v_batch_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    null, 'system', 'rider_payment_batch_created', p_rider_id::text,
    format('Net ₹%s for %s deliveries (%s–%s)', v_net, v_count, p_period_start, p_period_end)
  );

  return jsonb_build_object(
    'success', true, 'batch_id', v_batch_id,
    'gross', v_gross, 'adjustments', p_adjustments,
    'net_payout', v_net, 'deliveries', v_count
  );
end;
$$;

-- ── confirm_rider_payment ───────────────────────────────────────
-- p_status: 'paid' | 'failed'
create or replace function confirm_rider_payment(
  p_batch_id           uuid,
  p_status             text,
  p_razorpay_payout_id text default null,
  p_failure_reason     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch rider_payments%rowtype;
begin
  select * into v_batch from rider_payments where id = p_batch_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Batch not found');
  end if;

  if v_batch.status not in ('pending', 'processing') then
    -- Idempotency: a retried confirmation for a finalised batch is a no-op.
    return jsonb_build_object('success', true, 'skipped', true, 'status', v_batch.status);
  end if;

  update rider_payments set
    status             = p_status,
    razorpay_payout_id = coalesce(p_razorpay_payout_id, razorpay_payout_id),
    failure_reason     = p_failure_reason,
    paid_at            = case when p_status = 'paid' then now() else null end,
    updated_at         = now()
  where id = p_batch_id;

  if p_status = 'paid' then
    update riders set today_earnings = 0, updated_at = now()
     where id = v_batch.rider_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    null, 'system', 'rider_payment_' || p_status, v_batch.rider_id::text,
    format('Batch %s: ₹%s for %s–%s', p_batch_id, v_batch.net_payout, v_batch.period_start, v_batch.period_end)
  );

  return jsonb_build_object('success', true, 'batch_id', p_batch_id, 'status', p_status);
end;
$$;

-- Money-movement RPCs: service_role only (admin UI must go via an Edge
-- Function), matching migration 015's vendor-payout treatment.
revoke execute on function create_rider_payment_batch(uuid, date, date, text, numeric, text) from authenticated, anon;
revoke execute on function confirm_rider_payment(uuid, text, text, text)                      from authenticated, anon;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'rider_payments',
  'migration_018: ported create_rider_payment_batch/confirm_rider_payment from legacy database/ tree into canonical supabase/migrations; service_role-only. Legacy database/ tree is now redundant.'
);
