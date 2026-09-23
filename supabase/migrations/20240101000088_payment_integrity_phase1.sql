-- ═══════════════════════════════════════════════════════════════════════
-- SETU — Migration 088: Phase 1 Payment Integrity
--
-- Goals:
--   1. Canonical payment-intent lifecycle per gateway attempt.
--   2. Canonical payment transaction ledger keyed by gateway payment ID.
--   3. Stateful webhook/dead-letter tracking with retry metadata.
--   4. Atomic capture reconciliation that locks the order before deciding
--      whether to confirm it or create a refund-required state.
--   5. Razorpay refund request lifecycle with idempotent claim/finalize RPCs.
--   6. Captured-after-cancel is NEVER credited to vendor escrow.
--
-- External Razorpay API calls intentionally remain outside Postgres. The
-- database records the durable intent first; Edge Functions perform the
-- provider call and then finalize the DB state through the RPCs below.
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- 1. PAYMENT INTENTS — one row per checkout/payment attempt
-- ───────────────────────────────────────────────────────────────────────
create table if not exists payment_intents (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid not null references orders(id) on delete cascade,
  user_id               uuid not null references auth.users(id) on delete cascade,
  attempt_no            integer not null check (attempt_no > 0),
  provider              text not null default 'razorpay',
  provider_order_id     text unique,
  expected_amount       numeric(10,2) not null check (expected_amount > 0),
  currency              text not null default 'INR',
  status                text not null default 'creating'
                         check (status in (
                           'creating','created','checkout_open','payment_pending',
                           'failed','cancelled','captured','refund_pending',
                           'refunded','reconciliation_required'
                         )),
  provider_payment_id   text unique,
  failure_code          text,
  failure_reason        text,
  checkout_started_at   timestamptz,
  captured_at           timestamptz,
  cancelled_at          timestamptz,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (order_id, attempt_no)
);

create index if not exists idx_payment_intents_order_id
  on payment_intents(order_id);
create index if not exists idx_payment_intents_user_id
  on payment_intents(user_id);
create index if not exists idx_payment_intents_status
  on payment_intents(status);
create unique index if not exists idx_payment_intents_active_order
  on payment_intents(order_id)
  where status in ('creating','created','checkout_open','payment_pending','refund_pending');

alter table payment_intents enable row level security;
drop policy if exists "payment_intents_own_read" on payment_intents;
create policy "payment_intents_own_read"
  on payment_intents for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- ───────────────────────────────────────────────────────────────────────
-- 2. CANONICAL PAYMENT TRANSACTION LEDGER
-- ───────────────────────────────────────────────────────────────────────
create table if not exists payment_transactions (
  id                    uuid primary key default gen_random_uuid(),
  order_id              uuid references orders(id) on delete set null,
  payment_intent_id     uuid references payment_intents(id) on delete set null,
  user_id               uuid references auth.users(id) on delete set null,
  provider              text not null default 'razorpay',
  provider_order_id     text,
  provider_payment_id   text unique,
  amount                numeric(10,2) not null check (amount > 0),
  currency              text not null default 'INR',
  method                text,
  status                text not null default 'pending'
                         check (status in ('pending','captured','failed','refunded','partially_refunded','reconciliation_required')),
  reconciliation_state text not null default 'pending'
                         check (reconciliation_state in (
                           'pending','applied','refund_required','refund_pending',
                           'refunded','manual_review'
                         )),
  failure_code          text,
  failure_reason        text,
  gateway_payload       jsonb not null default '{}'::jsonb,
  captured_at           timestamptz,
  refunded_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_payment_transactions_order_id
  on payment_transactions(order_id);
create index if not exists idx_payment_transactions_intent_id
  on payment_transactions(payment_intent_id);
create index if not exists idx_payment_transactions_status
  on payment_transactions(status);
create index if not exists idx_payment_transactions_reconciliation
  on payment_transactions(reconciliation_state);

alter table payment_transactions enable row level security;
drop policy if exists "payment_transactions_own_read" on payment_transactions;
create policy "payment_transactions_own_read"
  on payment_transactions for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- ───────────────────────────────────────────────────────────────────────
-- 3. STATEFUL WEBHOOK / DEAD-LETTER METADATA
-- ───────────────────────────────────────────────────────────────────────
alter table payment_events
  add column if not exists processing_status text not null default 'pending';
alter table payment_events
  add column if not exists attempt_count integer not null default 0;
alter table payment_events
  add column if not exists last_error text;
alter table payment_events
  add column if not exists first_attempted_at timestamptz;
alter table payment_events
  add column if not exists last_attempted_at timestamptz;
alter table payment_events
  add column if not exists dead_letter_at timestamptz;
alter table payment_events
  add column if not exists order_id uuid references orders(id) on delete set null;
alter table payment_events
  add column if not exists payment_id text;
alter table payment_events
  add column if not exists refund_id text;

alter table payment_events drop constraint if exists payment_events_processing_status_check;
alter table payment_events
  add constraint payment_events_processing_status_check
  check (processing_status in ('pending','processing','succeeded','failed','dead_letter'));

create index if not exists idx_payment_events_processing
  on payment_events(processing_status, last_attempted_at);
create index if not exists idx_payment_events_dead_letter
  on payment_events(dead_letter_at) where dead_letter_at is not null;
create index if not exists idx_payment_events_order_id
  on payment_events(order_id) where order_id is not null;
create index if not exists idx_payment_events_payment_id
  on payment_events(payment_id) where payment_id is not null;

-- ───────────────────────────────────────────────────────────────────────
-- 4. REFUND LIFECYCLE HARDENING
-- ───────────────────────────────────────────────────────────────────────
alter table order_refunds
  add column if not exists razorpay_payment_id text;
alter table order_refunds
  add column if not exists requested_at timestamptz;
alter table order_refunds
  add column if not exists processing_at timestamptz;
alter table order_refunds
  add column if not exists retry_count integer not null default 0;
alter table order_refunds
  add column if not exists provider_payload jsonb not null default '{}'::jsonb;

create unique index if not exists idx_order_refunds_razorpay_refund_id
  on order_refunds(razorpay_refund_id)
  where razorpay_refund_id is not null;
create index if not exists idx_order_refunds_payment_id
  on order_refunds(razorpay_payment_id)
  where razorpay_payment_id is not null;

-- ───────────────────────────────────────────────────────────────────────
-- 5. COMMON updated_at triggers
-- ───────────────────────────────────────────────────────────────────────
drop trigger if exists trg_payment_intents_updated_at on payment_intents;
create trigger trg_payment_intents_updated_at
  before update on payment_intents
  for each row execute function update_updated_at();

drop trigger if exists trg_payment_transactions_updated_at on payment_transactions;
create trigger trg_payment_transactions_updated_at
  before update on payment_transactions
  for each row execute function update_updated_at();

-- ───────────────────────────────────────────────────────────────────────
-- 6. CREATE / BIND / FAIL PAYMENT INTENT
-- ───────────────────────────────────────────────────────────────────────
create or replace function create_payment_intent(
  p_order_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_existing payment_intents%rowtype;
  v_attempt integer;
  v_intent payment_intents%rowtype;
begin
  if p_order_id is null or p_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Missing payment intent parameters');
  end if;

  select * into v_order
    from orders
   where id = p_order_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

  if v_order.customer_id <> p_user_id then
    return jsonb_build_object('success', false, 'error', 'Not your order');
  end if;

  if v_order.payment_method <> 'UPI' then
    return jsonb_build_object('success', false, 'error', 'Order does not require Razorpay payment');
  end if;

  if v_order.payment_status = 'paid' then
    return jsonb_build_object('success', false, 'error', 'Order is already paid');
  end if;

  if v_order.status <> 'pending' or v_order.payment_status not in ('pending','failed') then
    return jsonb_build_object('success', false, 'error', 'Order is not payable');
  end if;

  -- A previous active attempt is reused. This prevents two concurrent
  -- checkout taps from creating two independent Razorpay orders.
  select * into v_existing
    from payment_intents
   where order_id = p_order_id
     and status in ('creating','created','checkout_open','payment_pending','refund_pending')
   order by attempt_no desc
   limit 1
   for update;

  if found then
    return jsonb_build_object(
      'success', true,
      'reused', true,
      'intent_id', v_existing.id,
      'attempt_no', v_existing.attempt_no,
      'provider_order_id', v_existing.provider_order_id,
      'amount', v_existing.expected_amount,
      'currency', v_existing.currency,
      'status', v_existing.status
    );
  end if;

  select coalesce(max(attempt_no), 0) + 1 into v_attempt
    from payment_intents
   where order_id = p_order_id;

  insert into payment_intents (
    order_id, user_id, attempt_no, expected_amount, currency, status
  ) values (
    p_order_id, p_user_id, v_attempt, v_order.total, 'INR', 'creating'
  ) returning * into v_intent;

  return jsonb_build_object(
    'success', true,
    'reused', false,
    'intent_id', v_intent.id,
    'attempt_no', v_intent.attempt_no,
    'provider_order_id', null,
    'amount', v_intent.expected_amount,
    'currency', v_intent.currency,
    'status', v_intent.status
  );
end;
$$;

create or replace function bind_payment_intent(
  p_intent_id uuid,
  p_provider_order_id text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_intent payment_intents%rowtype;
begin
  select * into v_intent from payment_intents where id = p_intent_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Payment intent not found'); end if;

  if v_intent.provider_order_id is not null
     and v_intent.provider_order_id <> p_provider_order_id then
    return jsonb_build_object('success', false, 'error', 'Payment intent already bound to another provider order');
  end if;

  update payment_intents set
    provider_order_id = p_provider_order_id,
    status = case when status = 'creating' then 'created' else status end,
    metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
    updated_at = now()
  where id = p_intent_id;

  return jsonb_build_object('success', true, 'intent_id', p_intent_id, 'provider_order_id', p_provider_order_id);
end;
$$;

create or replace function fail_payment_intent(
  p_intent_id uuid,
  p_failure_code text default null,
  p_failure_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_intent payment_intents%rowtype;
begin
  select * into v_intent from payment_intents where id = p_intent_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Payment intent not found'); end if;

  if v_intent.status in ('captured','refunded') then
    return jsonb_build_object('success', true, 'ignored', true, 'status', v_intent.status);
  end if;

  update payment_intents set
    status = 'failed', failure_code = p_failure_code,
    failure_reason = p_failure_reason, updated_at = now()
  where id = p_intent_id;

  return jsonb_build_object('success', true, 'status', 'failed');
end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 7. ATOMIC PAYMENT CAPTURE RECONCILIATION
-- ───────────────────────────────────────────────────────────────────────
create or replace function reconcile_razorpay_capture(
  p_order_id uuid,
  p_payment_intent_id uuid,
  p_razorpay_order_id text,
  p_payment_id text,
  p_amount numeric,
  p_method text default null,
  p_gateway_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_intent payment_intents%rowtype;
  v_tx payment_transactions%rowtype;
  v_refund order_refunds%rowtype;
  v_expected numeric;
begin
  if p_order_id is null or p_payment_id is null or p_razorpay_order_id is null or p_amount is null then
    return jsonb_build_object('success', false, 'error', 'Missing capture parameters');
  end if;

  -- THE critical race lock: whichever of cancellation or capture gets
  -- the order lock first wins the business-state decision. The loser
  -- observes the committed state and cannot incorrectly credit escrow.
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found', 'manual_review', true);
  end if;

  if p_payment_intent_id is not null then
    select * into v_intent
      from payment_intents
     where id = p_payment_intent_id
       and order_id = p_order_id
     for update;
  end if;

  if v_intent.id is null then
    select * into v_intent
      from payment_intents
     where provider_order_id = p_razorpay_order_id
       and order_id = p_order_id
     order by attempt_no desc
     limit 1
     for update;
  end if;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Payment intent not found', 'manual_review', true);
  end if;

  select * into v_tx from payment_transactions where provider_payment_id = p_payment_id for update;
  if found and v_tx.order_id is distinct from p_order_id then
    return jsonb_build_object('success', false, 'manual_review', true, 'error', 'Payment ID is already bound to a different order');
  end if;

  v_expected := v_intent.expected_amount;
  if abs(v_expected - p_amount) > 0.01 or abs(v_order.total - p_amount) > 0.01 then
    update payment_intents set
      status = 'reconciliation_required',
      provider_payment_id = coalesce(provider_payment_id, p_payment_id),
      failure_reason = format('Captured ₹%s but expected ₹%s', p_amount, v_order.total),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('amount_mismatch', true),
      updated_at = now()
    where id = v_intent.id;

    insert into payment_transactions (
      order_id, payment_intent_id, user_id, provider, provider_order_id,
      provider_payment_id, amount, currency, method, status,
      reconciliation_state, failure_reason, gateway_payload
    ) values (
      p_order_id, v_intent.id, v_order.customer_id, 'razorpay',
      p_razorpay_order_id, p_payment_id, p_amount, 'INR', p_method,
      'captured', 'manual_review',
      format('Captured ₹%s but expected ₹%s', p_amount, v_order.total),
      coalesce(p_gateway_payload, '{}'::jsonb)
    )
    on conflict (provider_payment_id) do update set
      gateway_payload = excluded.gateway_payload,
      updated_at = now();

    return jsonb_build_object(
      'success', false, 'error', 'Payment amount mismatch',
      'manual_review', true, 'expected_amount', v_order.total, 'captured_amount', p_amount
    );
  end if;

  insert into payment_transactions (
    order_id, payment_intent_id, user_id, provider, provider_order_id,
    provider_payment_id, amount, currency, method, status,
    reconciliation_state, captured_at, gateway_payload
  ) values (
    p_order_id, v_intent.id, v_order.customer_id, 'razorpay',
    p_razorpay_order_id, p_payment_id, p_amount, 'INR', p_method,
    'captured', 'pending', now(), coalesce(p_gateway_payload, '{}'::jsonb)
  )
  on conflict (provider_payment_id) do update set
    order_id = excluded.order_id,
    payment_intent_id = excluded.payment_intent_id,
    provider_order_id = excluded.provider_order_id,
    amount = excluded.amount,
    method = coalesce(excluded.method, payment_transactions.method),
    status = case when payment_transactions.status = 'refunded' then payment_transactions.status else 'captured' end,
    gateway_payload = excluded.gateway_payload,
    captured_at = coalesce(payment_transactions.captured_at, excluded.captured_at),
    updated_at = now()
  returning * into v_tx;

  -- Idempotent replay of a payment already reconciled.
  if v_tx.reconciliation_state = 'applied' or v_order.payment_status = 'paid' then
    update payment_intents set
      provider_payment_id = p_payment_id,
      status = 'captured',
      captured_at = coalesce(captured_at, now()),
      updated_at = now()
    where id = v_intent.id;

    update payment_transactions set
      reconciliation_state = case when reconciliation_state = 'pending' then 'applied' else reconciliation_state end,
      updated_at = now()
    where id = v_tx.id;

    return jsonb_build_object('success', true, 'already_applied', true, 'order_id', p_order_id);
  end if;

  -- CAPTURED-AFTER-CANCEL: the payment is real, but the order is dead.
  -- Never call record_delivery_split() in this branch.
  if v_order.status = 'cancelled' then
    update payment_intents set
      provider_payment_id = p_payment_id,
      status = 'refund_pending',
      captured_at = coalesce(captured_at, now()),
      updated_at = now()
    where id = v_intent.id;

    insert into order_refunds (
      order_id, customer_id, refund_amount, refund_method, status,
      razorpay_payment_id, requested_at, cancel_reason, initiated_by
    ) values (
      p_order_id, v_order.customer_id, v_order.total, 'razorpay', 'pending',
      p_payment_id, now(), coalesce(v_order.cancel_reason, 'Payment captured after order cancellation'), null
    )
    on conflict (order_id) do update set
      refund_amount = excluded.refund_amount,
      refund_method = 'razorpay',
      razorpay_payment_id = coalesce(order_refunds.razorpay_payment_id, excluded.razorpay_payment_id),
      status = case when order_refunds.status = 'completed' then order_refunds.status else 'pending' end,
      requested_at = coalesce(order_refunds.requested_at, excluded.requested_at),
      updated_at = now();

    update payment_transactions set
      reconciliation_state = 'refund_required',
      updated_at = now()
    where id = v_tx.id;

    return jsonb_build_object(
      'success', true,
      'refund_required', true,
      'order_id', p_order_id,
      'refund_amount', v_order.total,
      'payment_id', p_payment_id
    );
  end if;

  -- Any other state that is not a payable pending order is a manual
  -- reconciliation case. Do not release escrow.
  if v_order.payment_status not in ('pending','failed') or v_order.status <> 'pending' then
    update payment_intents set
      provider_payment_id = p_payment_id,
      status = 'reconciliation_required',
      captured_at = coalesce(captured_at, now()),
      updated_at = now()
    where id = v_intent.id;
    update payment_transactions set reconciliation_state = 'manual_review', updated_at = now()
     where id = v_tx.id;
    return jsonb_build_object('success', false, 'manual_review', true, 'error', 'Order is not in a payable state');
  end if;

  perform _set_internal_payment_flag();
  update orders set
    payment_status = 'paid',
    status = 'confirmed',
    confirmed_at = coalesce(confirmed_at, now()),
    updated_at = now()
  where id = p_order_id;

  perform record_delivery_split(p_order_id, p_payment_id);

  update payment_intents set
    provider_payment_id = p_payment_id,
    status = 'captured',
    captured_at = coalesce(captured_at, now()),
    updated_at = now()
  where id = v_intent.id;

  update payment_transactions set
    reconciliation_state = 'applied',
    updated_at = now()
  where id = v_tx.id;

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'captured', true);
end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 8. PAYMENT FAILURE RECONCILIATION
-- ───────────────────────────────────────────────────────────────────────
create or replace function reconcile_razorpay_failure(
  p_razorpay_order_id text,
  p_payment_id text default null,
  p_failure_code text default null,
  p_failure_reason text default null,
  p_gateway_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intent payment_intents%rowtype;
  v_order orders%rowtype;
begin
  select * into v_intent
    from payment_intents
   where provider_order_id = p_razorpay_order_id
   order by attempt_no desc
   limit 1
   for update;

  if not found then
    return jsonb_build_object('success', false, 'manual_review', true, 'error', 'Payment intent not found');
  end if;

  select * into v_order from orders where id = v_intent.order_id for update;

  insert into payment_transactions (
    order_id, payment_intent_id, user_id, provider, provider_order_id,
    provider_payment_id, amount, currency, status, reconciliation_state,
    failure_code, failure_reason, gateway_payload
  ) values (
    v_order.id, v_intent.id, v_order.customer_id, 'razorpay',
    p_razorpay_order_id, p_payment_id, v_intent.expected_amount, v_intent.currency,
    'failed', 'applied', p_failure_code, p_failure_reason, coalesce(p_gateway_payload, '{}'::jsonb)
  )
  on conflict (provider_payment_id) do update set
    status = case when payment_transactions.status in ('captured','refunded','partially_refunded') then payment_transactions.status else 'failed' end,
    failure_code = excluded.failure_code,
    failure_reason = excluded.failure_reason,
    gateway_payload = excluded.gateway_payload,
    updated_at = now();

  update payment_intents set
    provider_payment_id = coalesce(p_payment_id, provider_payment_id),
    status = case when status in ('captured','refunded','refund_pending') then status else 'failed' end,
    failure_code = p_failure_code,
    failure_reason = p_failure_reason,
    updated_at = now()
  where id = v_intent.id;

  -- A payment.failed event must never move an already-cancelled/paid order
  -- backwards. Only a still-pending order may become payment_failed.
  if v_order.status = 'pending' and v_order.payment_status = 'pending' then
    perform _set_internal_payment_flag();
    update orders set payment_status = 'failed', updated_at = now()
     where id = v_order.id and payment_status = 'pending';
  end if;

  return jsonb_build_object('success', true, 'order_id', v_order.id, 'status', 'failed');
end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 9. REFUND CLAIM / FINALIZE RPCs
-- ───────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────
create or replace function claim_razorpay_refund(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund order_refunds%rowtype;
  v_tx payment_transactions%rowtype;
begin
  select * into v_refund
    from order_refunds
   where order_id = p_order_id
     and refund_method = 'razorpay'
   for update;

  if not found then return jsonb_build_object('success', false, 'error', 'Refund request not found'); end if;
  if v_refund.status = 'completed' then
    return jsonb_build_object('success', true, 'already_completed', true, 'refund_id', v_refund.id, 'razorpay_refund_id', v_refund.razorpay_refund_id);
  end if;

  -- A processing row is a lease held by another refund attempt. Do not
  -- immediately issue a second provider refund if the first request may
  -- have succeeded but its HTTP response was lost. A stale lease (>10m)
  -- is reclaimable for recovery.
  if v_refund.status = 'processing'
     and v_refund.processing_at is not null
     and v_refund.processing_at > now() - interval '10 minutes' then
    return jsonb_build_object('success', true, 'in_progress', true, 'refund_id', v_refund.id, 'status', 'processing');
  end if;

  if v_refund.razorpay_payment_id is null then
    select * into v_tx from payment_transactions
     where order_id = p_order_id and status = 'captured'
     order by captured_at desc nulls last, created_at desc
     limit 1;
    if found then
      update order_refunds set razorpay_payment_id = v_tx.provider_payment_id, updated_at = now()
       where id = v_refund.id;
      v_refund.razorpay_payment_id := v_tx.provider_payment_id;
    end if;
  end if;

  if v_refund.razorpay_payment_id is null then
    return jsonb_build_object('success', false, 'error', 'No captured Razorpay payment is linked to this refund');
  end if;

  update order_refunds set
    status = 'processing',
    processing_at = coalesce(processing_at, now()),
    requested_at = coalesce(requested_at, now()),
    retry_count = retry_count + 1,
    updated_at = now()
  where id = v_refund.id
    and status in ('pending','failed','processing');

  select * into v_refund from order_refunds where id = v_refund.id;

  return jsonb_build_object(
    'success', true,
    'refund_id', v_refund.id,
    'order_id', p_order_id,
    'razorpay_payment_id', v_refund.razorpay_payment_id,
    'amount', v_refund.refund_amount,
    'status', v_refund.status,
    'razorpay_refund_id', v_refund.razorpay_refund_id
  );
end;
$$;

create or replace function complete_razorpay_refund(
  p_refund_id uuid,
  p_razorpay_refund_id text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_refund order_refunds%rowtype;
  v_order orders%rowtype;
  v_tx payment_transactions%rowtype;
begin
  select * into v_refund from order_refunds where id = p_refund_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Refund not found'); end if;
  select * into v_order from orders where id = v_refund.order_id for update;

  update order_refunds set
    status = 'completed',
    razorpay_refund_id = coalesce(razorpay_refund_id, p_razorpay_refund_id),
    completed_at = coalesce(completed_at, now()),
    provider_payload = coalesce(provider_payload, '{}'::jsonb) || coalesce(p_provider_payload, '{}'::jsonb),
    updated_at = now()
  where id = v_refund.id;

  perform _set_internal_payment_flag();
  update orders set payment_status = 'refunded', updated_at = now()
   where id = v_order.id and payment_status <> 'refunded';

  update payment_transactions set
    status = 'refunded', reconciliation_state = 'refunded', refunded_at = coalesce(refunded_at, now()), updated_at = now()
   where order_id = v_order.id and provider_payment_id = v_refund.razorpay_payment_id;

  update payment_intents set
    status = 'refunded', updated_at = now()
   where order_id = v_order.id and provider_payment_id = v_refund.razorpay_payment_id;

  return jsonb_build_object('success', true, 'refund_id', v_refund.id, 'order_id', v_order.id);
end;
$$;

create or replace function fail_razorpay_refund(
  p_refund_id uuid,
  p_failure_reason text,
  p_provider_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_refund order_refunds%rowtype;
begin
  select * into v_refund from order_refunds where id = p_refund_id for update;
  if not found then return jsonb_build_object('success', false, 'error', 'Refund not found'); end if;
  if v_refund.status = 'completed' then return jsonb_build_object('success', true, 'already_completed', true); end if;

  update order_refunds set
    status = 'failed',
    failure_reason = p_failure_reason,
    provider_payload = coalesce(provider_payload, '{}'::jsonb) || coalesce(p_provider_payload, '{}'::jsonb),
    updated_at = now()
  where id = v_refund.id;

  update payment_transactions set reconciliation_state = 'refund_required', updated_at = now()
   where order_id = v_refund.order_id and provider_payment_id = v_refund.razorpay_payment_id;

  return jsonb_build_object('success', true, 'status', 'failed');
end;
$$;

-- ───────────────────────────────────────────────────────────────────────
-- 10. EXECUTE PRIVILEGES — service role only for payment orchestration
-- ───────────────────────────────────────────────────────────────────────
revoke execute on function create_payment_intent(uuid, uuid) from public, anon, authenticated;
revoke execute on function bind_payment_intent(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function fail_payment_intent(uuid, text, text) from public, anon, authenticated;
revoke execute on function reconcile_razorpay_capture(uuid, uuid, text, text, numeric, text, jsonb) from public, anon, authenticated;
revoke execute on function reconcile_razorpay_failure(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function claim_razorpay_refund(uuid) from public, anon, authenticated;
revoke execute on function complete_razorpay_refund(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function fail_razorpay_refund(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function create_payment_intent(uuid, uuid) to service_role;
grant execute on function bind_payment_intent(uuid, text, jsonb) to service_role;
grant execute on function fail_payment_intent(uuid, text, text) to service_role;
grant execute on function reconcile_razorpay_capture(uuid, uuid, text, text, numeric, text, jsonb) to service_role;
grant execute on function reconcile_razorpay_failure(text, text, text, text, jsonb) to service_role;
grant execute on function claim_razorpay_refund(uuid) to service_role;
grant execute on function complete_razorpay_refund(uuid, text, jsonb) to service_role;
grant execute on function fail_razorpay_refund(uuid, text, jsonb) to service_role;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'security_migration', 'payment_integrity_phase1', 'payment',
  'migration_088: canonical payment intents and payment transaction ledger; stateful webhook/dead-letter metadata; atomic Razorpay capture reconciliation with order locking; captured-after-cancel creates a Razorpay refund request and never credits vendor escrow; idempotent refund claim/finalization RPCs.'
);

-- ───────────────────────────────────────────────────────────────────────
-- 11. ATOMIC WEBHOOK EVENT CLAIM
-- ───────────────────────────────────────────────────────────────────────
create or replace function claim_payment_event(p_event_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event payment_events%rowtype;
  v_attempt integer;
begin
  select * into v_event from payment_events where event_id = p_event_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Event not found');
  end if;

  if v_event.processed_at is not null or v_event.processing_status = 'succeeded' then
    return jsonb_build_object('success', true, 'already_processed', true, 'attempt_count', v_event.attempt_count);
  end if;

  if v_event.processing_status = 'dead_letter' then
    return jsonb_build_object('success', true, 'dead_letter', true, 'attempt_count', v_event.attempt_count);
  end if;

  v_attempt := coalesce(v_event.attempt_count, 0) + 1;
  update payment_events set
    processing_status = 'processing',
    attempt_count = v_attempt,
    first_attempted_at = coalesce(first_attempted_at, now()),
    last_attempted_at = now(),
    last_error = null
  where event_id = p_event_id;

  return jsonb_build_object('success', true, 'claimed', true, 'attempt_count', v_attempt);
end;
$$;

revoke execute on function claim_payment_event(text) from public, anon, authenticated;
grant execute on function claim_payment_event(text) to service_role;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (null, 'system', 'schema_migration', 'payment_events', 'payment',
  'migration_088 extension: atomic FOR UPDATE webhook event claim prevents concurrent duplicate webhook deliveries from executing the same financial side effects simultaneously.');
