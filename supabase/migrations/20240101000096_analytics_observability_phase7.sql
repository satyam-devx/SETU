-- Phase 7 — Analytics & observability
-- Immutable event streams + derived analytics + reconciliation dashboard.

create table if not exists immutable_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  order_number text,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system',
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_immutable_order_events_order on immutable_order_events(order_id, occurred_at desc);
create index if not exists idx_immutable_order_events_type on immutable_order_events(event_type, occurred_at desc);

create table if not exists immutable_payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  payment_intent_id uuid references payment_intents(id) on delete set null,
  provider_payment_id text,
  provider_event_id text,
  event_type text not null,
  amount numeric(14,2),
  currency text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create unique index if not exists uq_immutable_payment_provider_event on immutable_payment_events(provider_event_id) where provider_event_id is not null;
create index if not exists idx_immutable_payment_events_order on immutable_payment_events(order_id, occurred_at desc);
create index if not exists idx_immutable_payment_events_type on immutable_payment_events(event_type, occurred_at desc);

create table if not exists immutable_delivery_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  rider_id uuid references riders(id) on delete set null,
  event_type text not null,
  attempt_id uuid,
  proof_id uuid,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_immutable_delivery_events_order on immutable_delivery_events(order_id, occurred_at desc);
create index if not exists idx_immutable_delivery_events_rider on immutable_delivery_events(rider_id, occurred_at desc);

create table if not exists immutable_financial_events (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid references financial_journals(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  event_type text not null,
  amount numeric(14,2),
  currency text not null default 'INR',
  reference_type text,
  reference_id text,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists idx_immutable_financial_events_order on immutable_financial_events(order_id, occurred_at desc);
create index if not exists idx_immutable_financial_events_type on immutable_financial_events(event_type, occurred_at desc);

alter table immutable_order_events enable row level security;
alter table immutable_payment_events enable row level security;
alter table immutable_delivery_events enable row level security;
alter table immutable_financial_events enable row level security;
create policy immutable_order_events_admin_read on immutable_order_events for select using (is_admin());
create policy immutable_payment_events_admin_read on immutable_payment_events for select using (is_admin());
create policy immutable_delivery_events_admin_read on immutable_delivery_events for select using (is_admin());
create policy immutable_financial_events_admin_read on immutable_financial_events for select using (is_admin());

-- Event streams are append-only. Only SECURITY DEFINER server functions/triggers can write.
create or replace function prevent_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'Immutable event rows cannot be updated or deleted';
end $$;

revoke all on immutable_order_events from authenticated, anon;
revoke all on immutable_payment_events from authenticated, anon;
revoke all on immutable_delivery_events from authenticated, anon;
revoke all on immutable_financial_events from authenticated, anon;

do $$
begin
  if not exists(select 1 from pg_trigger where tgname='trg_immutable_order_events_guard') then
    create trigger trg_immutable_order_events_guard before update or delete on immutable_order_events for each row execute function prevent_mutation();
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_immutable_payment_events_guard') then
    create trigger trg_immutable_payment_events_guard before update or delete on immutable_payment_events for each row execute function prevent_mutation();
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_immutable_delivery_events_guard') then
    create trigger trg_immutable_delivery_events_guard before update or delete on immutable_delivery_events for each row execute function prevent_mutation();
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_immutable_financial_events_guard') then
    create trigger trg_immutable_financial_events_guard before update or delete on immutable_financial_events for each row execute function prevent_mutation();
  end if;
end $$;

-- Generic append-only trigger helper. Trigger functions run with definer rights.
create or replace function emit_order_observability_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into immutable_order_events(order_id,order_number,event_type,to_status,actor_id,actor_type,payload)
    values(new.id,new.order_number,'order_created',new.status,auth.uid(),'system',jsonb_build_object('payment_method',new.payment_method,'payment_status',new.payment_status,'total',new.total));
  elsif tg_op='UPDATE' then
    if new.status is distinct from old.status then
      insert into immutable_order_events(order_id,order_number,event_type,from_status,to_status,actor_id,actor_type,payload)
      values(new.id,new.order_number,'status_changed',old.status,new.status,auth.uid(),'system',jsonb_build_object('payment_status',new.payment_status));
    end if;
    if new.payment_status is distinct from old.payment_status then
      insert into immutable_order_events(order_id,order_number,event_type,actor_id,actor_type,payload)
      values(new.id,new.order_number,'payment_status_changed',auth.uid(),'system',jsonb_build_object('from',old.payment_status,'to',new.payment_status));
    end if;
    if new.rider_id is distinct from old.rider_id and new.rider_id is not null then
      insert into immutable_order_events(order_id,order_number,event_type,actor_id,actor_type,payload)
      values(new.id,new.order_number,'rider_bound',auth.uid(),'system',jsonb_build_object('rider_id',new.rider_id));
    end if;
  end if;
  return new;
end $$;

do $$ begin
  if not exists(select 1 from pg_trigger where tgname='trg_orders_observability') then
    create trigger trg_orders_observability after insert or update of status,payment_status,rider_id on orders for each row execute function emit_order_observability_event();
  end if;
end $$;

-- Payment events are sourced from the existing webhook/event ledger and copied append-only.
create or replace function emit_payment_observability_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_payment_intent uuid; v_payment text; v_amount numeric; v_currency text;
begin
  v_order := nullif(new.order_id::text,'')::uuid;
  v_payment_intent := nullif(new.payload->>'payment_intent_id','')::uuid;
  v_payment := coalesce(new.payment_id,new.payload->>'razorpay_payment_id');
  v_amount := nullif(new.payload->>'amount','')::numeric;
  v_currency := coalesce(new.payload->>'currency','INR');
  insert into immutable_payment_events(order_id,payment_intent_id,provider_payment_id,provider_event_id,event_type,amount,currency,payload)
  values(v_order,v_payment_intent,v_payment,new.event_id,new.type,v_amount,v_currency,new.payload)
  on conflict(provider_event_id) where provider_event_id is not null do nothing;
  return new;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgname='trg_payment_events_observability') then
    create trigger trg_payment_events_observability after insert on payment_events for each row execute function emit_payment_observability_event();
  end if;
end $$;

-- Delivery observability is generated from the immutable delivery attempt ledger and dispatch events.
create or replace function emit_delivery_attempt_observability()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into immutable_delivery_events(order_id,rider_id,event_type,attempt_id,payload)
  values(new.order_id,new.rider_id,'delivery_attempt',new.id,jsonb_build_object('status',new.status,'reason',new.reason,'attempt_no',new.attempt_no,'latitude',new.latitude,'longitude',new.longitude));
  return new;
end $$;
do $$ begin
  if to_regclass('public.delivery_attempts') is not null and not exists(select 1 from pg_trigger where tgname='trg_delivery_attempts_observability') then
    create trigger trg_delivery_attempts_observability after insert on delivery_attempts for each row execute function emit_delivery_attempt_observability();
  end if;
end $$;

-- Financial observability mirrors every balanced journal once it is posted.
create or replace function emit_financial_observability_event()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into immutable_financial_events(journal_id,order_id,event_type,reference_type,reference_id,payload)
  values(new.id,new.order_id,new.journal_type,new.reference_type,new.reference_id,jsonb_build_object('description',new.description));
  return new;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgname='trg_financial_journals_observability') then
    create trigger trg_financial_journals_observability after insert on financial_journals for each row execute function emit_financial_observability_event();
  end if;
end $$;

-- Derived analytics. These are views over immutable facts, so they can be rebuilt safely.
create or replace view analytics_daily_order_metrics as
select date_trunc('day',occurred_at)::date as day,
       count(*) filter(where event_type='status_changed' and to_status='delivered') as delivered_orders,
       count(*) filter(where event_type='status_changed' and to_status='cancelled') as cancelled_orders,
       count(*) filter(where event_type='status_changed' and to_status='ready') as ready_orders
from immutable_order_events group by 1 order by 1;

create or replace view analytics_daily_payment_metrics as
select date_trunc('day',occurred_at)::date as day,
       count(*) filter(where event_type='payment.captured') as captured_count,
       coalesce(sum(amount) filter(where event_type='payment.captured'),0) as captured_amount,
       count(*) filter(where event_type='payment.failed') as failed_count,
       count(*) filter(where event_type like 'refund.%') as refund_event_count
from immutable_payment_events group by 1 order by 1;

create or replace view analytics_daily_delivery_metrics as
select date_trunc('day',occurred_at)::date as day,
       count(*) filter(where event_type='delivery_attempt') as attempts
from immutable_delivery_events group by 1 order by 1;

create or replace view analytics_daily_financial_metrics as
select date_trunc('day',occurred_at)::date as day,
       count(*) as journals,
       coalesce(sum(case when event_type='order_capture' then amount else 0 end),0) as capture_amount
from immutable_financial_events group by 1 order by 1;

create or replace view reconciliation_dashboard as
select
  (select count(*) from payment_events where processing_status='dead_letter') payment_dead_letters,
  (select count(*) from orders o left join order_financials f on f.order_id=o.id where o.status='delivered' and f.order_id is null) delivered_without_financials,
  (select count(*) from orders o where o.status='delivered' and not exists(select 1 from delivery_financial_finalizations d where d.order_id=o.id)) delivered_without_finalization,
  (select count(*) from financial_settlements where status in ('pending','processing','failed')) open_settlements,
  (select count(*) from payout_reconciliations where reconciliation_status not in ('matched')) payout_reconciliation_exceptions,
  (select count(*) from immutable_payment_events where event_type='payment.captured' and order_id is null) unmatched_captures,
  (select count(*) from order_refunds where status in ('pending','processing')) pending_refunds;

grant select on analytics_daily_order_metrics,analytics_daily_payment_metrics,analytics_daily_delivery_metrics,analytics_daily_financial_metrics,reconciliation_dashboard to authenticated;

create or replace function get_observability_dashboard()
returns jsonb language plpgsql security definer set search_path=public as $$
declare r jsonb;
begin
  if not is_admin() then raise exception 'Admin access required'; end if;
  select jsonb_build_object(
    'reconciliation',(select to_jsonb(x) from reconciliation_dashboard x),
    'orders',(select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (select * from analytics_daily_order_metrics order by day desc limit 90) x),
    'payments',(select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (select * from analytics_daily_payment_metrics order by day desc limit 90) x),
    'delivery',(select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (select * from analytics_daily_delivery_metrics order by day desc limit 90) x),
    'financial',(select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (select * from analytics_daily_financial_metrics order by day desc limit 90) x)
  ) into r;
  return r;
end $$;
grant execute on function get_observability_dashboard() to authenticated;

insert into audit_log(actor_id,actor,action,target,target_type,detail)
values(null,'system','schema_migration','immutable_order_events,immutable_payment_events,immutable_delivery_events,immutable_financial_events','table','Phase 7: immutable observability streams, derived analytics and reconciliation dashboard.');
