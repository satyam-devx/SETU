-- SETU Kafka V2 — payment, inventory, dispatch and financial-ledger events.
-- These triggers extend the transactional outbox created in 00099.
-- PostgreSQL remains the source of truth. Kafka carries durable domain facts;
-- consumers must be idempotent and must never be treated as the write authority.

create or replace function public.setu_enqueue_kafka_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aggregate_type text;
  v_aggregate_id text;
  v_event_type text;
  v_new jsonb := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  v_old jsonb := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  v_payload jsonb;
begin
  v_aggregate_type := case TG_TABLE_NAME
    when 'orders' then 'order'
    when 'notifications' then 'notification'
    when 'rider_locations' then 'rider_location'
    when 'payment_intents' then 'payment'
    when 'payment_transactions' then 'payment'
    when 'payment_events' then 'payment'
    when 'order_refunds' then 'payment'
    when 'inventory_reservations' then 'inventory'
    when 'dispatch_events' then 'dispatch'
    when 'rider_offers' then 'dispatch'
    when 'dispatch_assignment_events' then 'dispatch'
    when 'financial_journals' then 'financial_ledger'
    when 'financial_settlements' then 'financial_ledger'
    when 'payout_reconciliations' then 'financial_ledger'
    else TG_TABLE_NAME
  end;

  v_aggregate_id := coalesce(
    v_new->>'id', v_old->>'id',
    v_new->>'order_id', v_old->>'order_id',
    v_new->>'payment_intent_id', v_old->>'payment_intent_id',
    v_new->>'settlement_id', v_old->>'settlement_id',
    v_new->>'rider_id', v_old->>'rider_id'
  );

  v_event_type := case
    when TG_TABLE_NAME = 'payment_intents' then 'payment.intent.' || lower(TG_OP)
    when TG_TABLE_NAME = 'payment_transactions' then 'payment.transaction.' || lower(TG_OP)
    when TG_TABLE_NAME = 'payment_events' then 'payment.gateway_event.' || lower(TG_OP)
    when TG_TABLE_NAME = 'order_refunds' then 'payment.refund.' || lower(TG_OP)
    when TG_TABLE_NAME = 'inventory_reservations' then 'inventory.reservation.' || lower(TG_OP)
    when TG_TABLE_NAME = 'dispatch_events' then 'dispatch.event.' || lower(TG_OP)
    when TG_TABLE_NAME = 'rider_offers' then 'dispatch.offer.' || lower(TG_OP)
    when TG_TABLE_NAME = 'dispatch_assignment_events' then 'dispatch.assignment.' || lower(TG_OP)
    when TG_TABLE_NAME = 'financial_journals' then 'financial.ledger.journal.' || lower(TG_OP)
    when TG_TABLE_NAME = 'financial_settlements' then 'financial.settlement.' || lower(TG_OP)
    when TG_TABLE_NAME = 'payout_reconciliations' then 'financial.reconciliation.' || lower(TG_OP)
    else lower(TG_TABLE_NAME || '.' || TG_OP)
  end;

  -- Never publish raw gateway payloads or other unnecessary private data.
  if TG_TABLE_NAME = 'payment_events' then
    v_new := jsonb_build_object(
      'id', v_new->>'id', 'event_type', v_new->>'event_type',
      'processing_status', v_new->>'processing_status', 'order_id', v_new->>'order_id',
      'payment_id', v_new->>'payment_id', 'refund_id', v_new->>'refund_id',
      'updated_at', v_new->>'updated_at'
    );
    v_old := null;
  elsif TG_TABLE_NAME = 'payment_transactions' then
    v_new := v_new - 'gateway_payload';
    v_old := v_old - 'gateway_payload';
  end if;

  v_payload := jsonb_build_object(
    'schema_version', 2,
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'new', v_new,
    'old', v_old,
    'occurred_at', now()
  );

  insert into public.setu_event_outbox(event_type, aggregate_type, aggregate_id, payload)
  values (v_event_type, v_aggregate_type, v_aggregate_id, v_payload);

  return coalesce(NEW, OLD);
end;
$$;

-- Payment lifecycle -------------------------------------------------------
drop trigger if exists trg_setu_kafka_payment_intents on public.payment_intents;
create trigger trg_setu_kafka_payment_intents
after insert or update or delete on public.payment_intents
for each row execute function public.setu_enqueue_kafka_event();

drop trigger if exists trg_setu_kafka_payment_transactions on public.payment_transactions;
create trigger trg_setu_kafka_payment_transactions
after insert or update or delete on public.payment_transactions
for each row execute function public.setu_enqueue_kafka_event();

drop trigger if exists trg_setu_kafka_payment_events on public.payment_events;
create trigger trg_setu_kafka_payment_events
after insert or update on public.payment_events
for each row execute function public.setu_enqueue_kafka_event();

drop trigger if exists trg_setu_kafka_order_refunds on public.order_refunds;
create trigger trg_setu_kafka_order_refunds
after insert or update or delete on public.order_refunds
for each row execute function public.setu_enqueue_kafka_event();

-- Inventory lifecycle -----------------------------------------------------
drop trigger if exists trg_setu_kafka_inventory_reservations on public.inventory_reservations;
create trigger trg_setu_kafka_inventory_reservations
after insert or update or delete on public.inventory_reservations
for each row execute function public.setu_enqueue_kafka_event();

-- Dispatch lifecycle ------------------------------------------------------
drop trigger if exists trg_setu_kafka_dispatch_events on public.dispatch_events;
create trigger trg_setu_kafka_dispatch_events
after insert or update or delete on public.dispatch_events
for each row execute function public.setu_enqueue_kafka_event();

drop trigger if exists trg_setu_kafka_rider_offers on public.rider_offers;
create trigger trg_setu_kafka_rider_offers
after insert or update or delete on public.rider_offers
for each row execute function public.setu_enqueue_kafka_event();

drop trigger if exists trg_setu_kafka_dispatch_assignment_events on public.dispatch_assignment_events;
create trigger trg_setu_kafka_dispatch_assignment_events
after insert or update or delete on public.dispatch_assignment_events
for each row execute function public.setu_enqueue_kafka_event();

-- Financial ledger lifecycle ---------------------------------------------
drop trigger if exists trg_setu_kafka_financial_journals on public.financial_journals;
create trigger trg_setu_kafka_financial_journals
after insert or update on public.financial_journals
for each row execute function public.setu_enqueue_kafka_event();

drop trigger if exists trg_setu_kafka_financial_settlements on public.financial_settlements;
create trigger trg_setu_kafka_financial_settlements
after insert or update on public.financial_settlements
for each row execute function public.setu_enqueue_kafka_event();

drop trigger if exists trg_setu_kafka_payout_reconciliations on public.payout_reconciliations;
create trigger trg_setu_kafka_payout_reconciliations
after insert or update on public.payout_reconciliations
for each row execute function public.setu_enqueue_kafka_event();

comment on function public.setu_enqueue_kafka_event() is
  'Transactional Kafka outbox publisher trigger for SETU payment, inventory, dispatch and financial domains. Sensitive gateway payloads are redacted.';
