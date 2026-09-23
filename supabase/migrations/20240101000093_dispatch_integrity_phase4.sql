-- Phase 4 — Dispatch integrity
-- Vendor-ready event -> rider matching -> expiring offers -> atomic assignment.

create table if not exists dispatch_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  event_type text not null check (event_type in ('ready_order','offer_sent','offer_expired','offer_declined','rider_assigned','dispatch_exhausted','dispatch_cancelled')),
  status text not null default 'pending' check (status in ('pending','offering','assigned','waiting_for_rider','exhausted','cancelled')),
  attempt_no integer not null default 0 check (attempt_no >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists idx_dispatch_events_order on dispatch_events(order_id, created_at desc);
create index if not exists idx_dispatch_events_status on dispatch_events(status, updated_at);
create unique index if not exists uq_dispatch_ready_event_order on dispatch_events(order_id) where event_type='ready_order';

create table if not exists rider_offers (
  id uuid primary key default gen_random_uuid(),
  dispatch_event_id uuid not null references dispatch_events(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  rider_id uuid not null references riders(id) on delete cascade,
  status text not null default 'offered' check (status in ('offered','accepted','declined','expired','cancelled')),
  rank integer not null default 1 check (rank > 0),
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  response_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dispatch_event_id, rider_id)
);
create index if not exists idx_rider_offers_rider_status on rider_offers(rider_id, status, expires_at);
create index if not exists idx_rider_offers_order_status on rider_offers(order_id, status, expires_at);
create unique index if not exists uq_rider_one_active_offer_order on rider_offers(order_id) where status='accepted';

create table if not exists dispatch_assignment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  rider_id uuid references riders(id) on delete set null,
  offer_id uuid references rider_offers(id) on delete set null,
  event_type text not null check (event_type in ('offer_created','offer_declined','offer_expired','rider_assigned','reassignment_started','dispatch_exhausted')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_dispatch_assignment_events_order on dispatch_assignment_events(order_id, created_at desc);
create index if not exists idx_dispatch_assignment_events_rider on dispatch_assignment_events(rider_id, created_at desc);

create trigger trg_dispatch_events_updated_at before update on dispatch_events
for each row execute function update_updated_at();
create trigger trg_rider_offers_updated_at before update on rider_offers
for each row execute function update_updated_at();

alter table dispatch_events enable row level security;
alter table rider_offers enable row level security;
alter table dispatch_assignment_events enable row level security;

create policy dispatch_events_own_order_read on dispatch_events for select to authenticated
using (
  order_id in (select id from orders where customer_id=auth.uid())
  or order_id in (select id from orders where vendor_id in (select id from vendors where owner_id=auth.uid()))
  or order_id in (select id from orders where rider_id in (select id from riders where user_id=auth.uid()))
  or is_admin()
);
create policy rider_offers_own_read on rider_offers for select to authenticated
using (rider_id in (select id from riders where user_id=auth.uid()) or is_admin());
create policy dispatch_assignment_events_own_read on dispatch_assignment_events for select to authenticated
using (
  order_id in (select id from orders where customer_id=auth.uid())
  or order_id in (select id from orders where vendor_id in (select id from vendors where owner_id=auth.uid()))
  or order_id in (select id from orders where rider_id in (select id from riders where user_id=auth.uid()))
  or is_admin()
);

-- Candidate matching: online + active + verified riders in the order village,
-- excluding riders with an active assigned delivery and riders already offered
-- this dispatch. Latest GPS is used as a deterministic proximity signal when
-- vendor coordinates are available; otherwise latest-location recency is used.
create or replace function _dispatch_offer_next_batch(p_dispatch_id uuid, p_limit integer default 3)
returns integer
language plpgsql security definer set search_path=public
as $$
declare
  v_event dispatch_events%rowtype;
  v_order orders%rowtype;
  v_vendor vendors%rowtype;
  v_count integer := 0;
  v_rider record;
begin
  select * into v_event from dispatch_events where id=p_dispatch_id for update;
  if not found then return 0; end if;
  select * into v_order from orders where id=v_event.order_id for update;
  if not found or v_order.status <> 'ready' or v_order.rider_id is not null then
    update dispatch_events set status='cancelled', processed_at=coalesce(processed_at,now()) where id=p_dispatch_id;
    return 0;
  end if;

  select * into v_vendor from vendors where id=v_order.vendor_id;

  for v_rider in
    select r.id, r.name,
           coalesce(loc.lat, v_vendor.lat) as lat,
           coalesce(loc.lng, v_vendor.lng) as lng,
           case when loc.lat is not null and v_vendor.lat is not null
                     and loc.lng is not null and v_vendor.lng is not null
                then 6371 * 2 * asin(sqrt(
                     power(sin(radians((loc.lat-v_vendor.lat)/2)),2) +
                     cos(radians(v_vendor.lat))*cos(radians(loc.lat))*power(sin(radians((loc.lng-v_vendor.lng)/2)),2)
                )) else 999999 end as distance_km
      from riders r
      left join lateral (
        select rl.lat, rl.lng
        from rider_locations rl
        where rl.rider_id=r.id and rl.recorded_at >= now()-interval '10 minutes'
        order by rl.recorded_at desc limit 1
      ) loc on true
      where r.is_active=true
        and r.is_verified=true
        and r.is_online=true
        and (r.village_id = v_order.village_id or v_order.village_id is null)
        and not exists (
          select 1 from orders ao
          where ao.rider_id=r.id and ao.status in ('picked_up','on_the_way')
        )
        and not exists (
          select 1 from rider_offers ro
          where ro.dispatch_event_id=v_event.id and ro.rider_id=r.id
        )
      order by distance_km asc, r.updated_at asc
      limit greatest(p_limit,1)
  loop
    insert into rider_offers(dispatch_event_id,order_id,rider_id,status,rank,expires_at)
    values(v_event.id,v_order.id,v_rider.id,'offered',v_event.attempt_no+v_count+1,now()+interval '45 seconds')
    on conflict (dispatch_event_id,rider_id) do nothing;
    if found then
      v_count := v_count + 1;
      insert into dispatch_assignment_events(order_id,rider_id,event_type,payload)
      values(v_order.id,v_rider.id,'offer_created',jsonb_build_object('dispatch_event_id',v_event.id,'expires_at',now()+interval '45 seconds'));
      insert into notifications(user_id,type,title,body,data)
      select r.user_id,'order','New delivery offer',
             format('Order %s is ready for pickup. You have 45 seconds to accept.',v_order.order_number),
             jsonb_build_object('event','rider_offer','order_id',v_order.id,'offer_id',(select ro.id from rider_offers ro where ro.dispatch_event_id=v_event.id and ro.rider_id=v_rider.id order by ro.created_at desc limit 1))
      from riders r where r.id=v_rider.id and r.user_id is not null;
    end if;
  end loop;

  update dispatch_events
     set status=case when v_count>0 then 'offering' else 'exhausted' end,
         attempt_no=attempt_no+v_count,
         processed_at=case when v_count=0 then now() else null end,
         payload=payload || jsonb_build_object('offers_created',v_count)
   where id=v_event.id;
  return v_count;
end;
$$;
revoke execute on function _dispatch_offer_next_batch(uuid,integer) from authenticated, anon;

create or replace function dispatch_ready_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_order orders%rowtype;
  v_vendor vendors%rowtype;
  v_event dispatch_events%rowtype;
  v_count integer;
begin
  select * into v_order from orders where id=p_order_id for update;
  if not found then return jsonb_build_object('success',false,'error','Order not found'); end if;
  if v_order.status <> 'ready' or v_order.rider_id is not null then return jsonb_build_object('success',false,'error','Order is not dispatchable'); end if;

  select * into v_event from dispatch_events where order_id=p_order_id and event_type='ready_order' for update;
  if not found then
    insert into dispatch_events(order_id,event_type,status,attempt_no,payload)
    values(p_order_id,'ready_order','pending',0,jsonb_build_object('source','vendor_ready')) returning * into v_event;
  end if;

  select * into v_vendor from vendors where id=v_order.vendor_id;
  if v_vendor.owner_id is not null then
    insert into notifications(user_id,type,title,body,data)
    values(v_vendor.owner_id,'order','Order ready for dispatch',
           format('Order %s is ready. Rider matching has started.',v_order.order_number),
           jsonb_build_object('event','ready_order_dispatch','order_id',p_order_id,'dispatch_event_id',v_event.id));
  end if;

  v_count := _dispatch_offer_next_batch(v_event.id,3);
  return jsonb_build_object('success',true,'dispatch_event_id',v_event.id,'offers_created',v_count);
end;
$$;
revoke execute on function dispatch_ready_order(uuid) from authenticated, anon;

drop trigger if exists trg_orders_ready_dispatch on orders;
create or replace function _trg_orders_ready_dispatch()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status='ready' and old.status is distinct from 'ready' and new.rider_id is null then
    perform dispatch_ready_order(new.id);
  end if;
  return new;
end;
$$;
create trigger trg_orders_ready_dispatch after update of status on orders
for each row execute function _trg_orders_ready_dispatch();

create or replace function respond_to_rider_offer(p_offer_id uuid, p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_rider riders%rowtype; v_offer rider_offers%rowtype; v_order orders%rowtype; v_event dispatch_events%rowtype;
begin
  if v_uid is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
  select * into v_rider from riders where user_id=v_uid and is_active=true for update;
  if not found then return jsonb_build_object('success',false,'error','Active rider not found'); end if;
  select * into v_offer from rider_offers where id=p_offer_id and rider_id=v_rider.id for update;
  if not found then return jsonb_build_object('success',false,'error','Offer not found'); end if;
  select * into v_order from orders where id=v_offer.order_id for update;
  select * into v_event from dispatch_events where id=v_offer.dispatch_event_id for update;

  if p_action not in ('accept','decline') then return jsonb_build_object('success',false,'error','Invalid action'); end if;
  if v_offer.status <> 'offered' then return jsonb_build_object('success',false,'error','Offer is no longer active'); end if;
  if v_offer.expires_at <= now() then
    update rider_offers set status='expired',responded_at=now(),response_reason='offer_timeout' where id=v_offer.id;
    insert into dispatch_assignment_events(order_id,rider_id,offer_id,event_type,payload) values(v_order.id,v_rider.id,v_offer.id,'offer_expired','{}');
    return jsonb_build_object('success',false,'error','Offer expired','expired',true);
  end if;

  if p_action='decline' then
    update rider_offers set status='declined',responded_at=now(),response_reason='rider_declined' where id=v_offer.id;
    insert into dispatch_assignment_events(order_id,rider_id,offer_id,event_type,payload) values(v_order.id,v_rider.id,v_offer.id,'offer_declined','{}');
    perform _dispatch_offer_next_batch(v_event.id,1);
    return jsonb_build_object('success',true,'status','declined');
  end if;

  if v_order.status <> 'ready' or v_order.rider_id is not null then
    update rider_offers set status='cancelled',responded_at=now(),response_reason='order_already_assigned' where id=v_offer.id;
    return jsonb_build_object('success',false,'error','Order is no longer available');
  end if;
  if exists(select 1 from orders ao where ao.rider_id=v_rider.id and ao.status in ('picked_up','on_the_way')) then
    return jsonb_build_object('success',false,'error','Rider already has an active delivery');
  end if;

  update rider_offers set status='accepted',responded_at=now(),response_reason='rider_accepted' where id=v_offer.id;
  update rider_offers set status='cancelled',responded_at=now(),response_reason='another_rider_assigned'
   where order_id=v_order.id and id<>v_offer.id and status='offered';
  update orders set rider_id=v_rider.id,rider_name=v_rider.name,updated_at=now() where id=v_order.id and status='ready' and rider_id is null;
  if not found then
    update rider_offers set status='cancelled',response_reason='assignment_race' where id=v_offer.id;
    return jsonb_build_object('success',false,'error','Assignment race lost; retry');
  end if;

  update dispatch_events set status='assigned',processed_at=now(),payload=payload || jsonb_build_object('rider_id',v_rider.id,'offer_id',v_offer.id) where id=v_event.id;
  insert into dispatch_assignment_events(order_id,rider_id,offer_id,event_type,payload)
  values(v_order.id,v_rider.id,v_offer.id,'rider_assigned',jsonb_build_object('dispatch_event_id',v_event.id));
  if v_order.customer_id is not null then
    insert into notifications(user_id,type,title,body,data)
    values(v_order.customer_id,'order','Rider assigned',format('A rider has been assigned to order %s.',v_order.order_number),jsonb_build_object('event','rider_assigned','order_id',v_order.id,'rider_id',v_rider.id));
  end if;
  if v_order.vendor_id is not null then
    insert into notifications(user_id,type,title,body,data)
    select v.owner_id,'order','Rider assigned',format('Rider %s has accepted order %s.',v_rider.name,v_order.order_number),jsonb_build_object('event','rider_assigned','order_id',v_order.id,'rider_id',v_rider.id)
    from vendors v where v.id=v_order.vendor_id and v.owner_id is not null;
  end if;
  return jsonb_build_object('success',true,'status','assigned','order_id',v_order.id,'rider_id',v_rider.id);
end;
$$;
grant execute on function respond_to_rider_offer(uuid,text) to authenticated;

-- Timeout/reassignment worker. It expires stale offers, records the realtime
-- event, then sends the next offer(s). It is intentionally service-role only.
create or replace function process_dispatch_timeouts(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_offer record; v_processed integer:=0; v_new integer:=0; v_event dispatch_events%rowtype;
begin
  for v_offer in
    select ro.* from rider_offers ro join dispatch_events de on de.id=ro.dispatch_event_id
    where ro.status='offered' and ro.expires_at <= now() and de.status='offering'
    order by ro.expires_at limit greatest(p_limit,1)
    for update of ro skip locked
  loop
    update rider_offers set status='expired',responded_at=now(),response_reason='offer_timeout' where id=v_offer.id;
    insert into dispatch_assignment_events(order_id,rider_id,offer_id,event_type,payload)
    values(v_offer.order_id,v_offer.rider_id,v_offer.id,'offer_expired',jsonb_build_object('reason','timeout'));
    v_processed:=v_processed+1;
  end loop;

  for v_event in
    select de.* from dispatch_events de
    where de.status='offering'
      and exists(select 1 from rider_offers ro where ro.dispatch_event_id=de.id and ro.status='expired')
      and not exists(select 1 from rider_offers ro where ro.dispatch_event_id=de.id and ro.status='offered')
    order by de.updated_at limit greatest(p_limit,1)
    for update
  loop
    v_new := v_new + _dispatch_offer_next_batch(v_event.id,1);
    if v_new=0 then
      update dispatch_events set status='exhausted',processed_at=now() where id=v_event.id;
      insert into dispatch_assignment_events(order_id,event_type,payload) values(v_event.order_id,'dispatch_exhausted',jsonb_build_object('dispatch_event_id',v_event.id));
      insert into notifications(user_id,type,title,body,data)
      select v.owner_id,'order','Rider search needs attention',format('No rider accepted order %s yet. Manual dispatch may be required.',o.order_number),jsonb_build_object('event','dispatch_exhausted','order_id',o.id)
      from orders o join vendors v on v.id=o.vendor_id where o.id=v_event.order_id and v.owner_id is not null;
    end if;
  end loop;
  return jsonb_build_object('success',true,'expired_offers',v_processed,'new_offers',v_new);
end;
$$;
revoke execute on function process_dispatch_timeouts(integer) from authenticated, anon;

-- Replace legacy direct rider claim: an authenticated rider can only accept a
-- real offer now. The old API remains compatible but no longer bypasses dispatch.
create or replace function claim_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_uid uuid:=auth.uid(); v_offer rider_offers%rowtype;
begin
  select ro.* into v_offer from rider_offers ro join riders r on r.id=ro.rider_id
  where ro.order_id=p_order_id and r.user_id=v_uid and ro.status='offered' order by ro.expires_at asc limit 1;
  if not found then return jsonb_build_object('success',false,'error','No active rider offer exists for this order'); end if;
  return respond_to_rider_offer(v_offer.id,'accept');
end;
$$;
grant execute on function claim_order(uuid) to authenticated;

-- Realtime: clients may subscribe to these server-generated dispatch facts.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dispatch_events') then
    alter publication supabase_realtime add table public.dispatch_events;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rider_offers') then
    alter publication supabase_realtime add table public.rider_offers;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dispatch_assignment_events') then
    alter publication supabase_realtime add table public.dispatch_assignment_events;
  end if;
end $$;

-- One-minute timeout/reassignment worker.
do $$
begin
  if not exists(select 1 from cron.job where jobname='process-rider-dispatch-timeouts') then
    perform cron.schedule('process-rider-dispatch-timeouts','* * * * *','select process_dispatch_timeouts(100);');
  end if;
end $$;

insert into audit_log(actor_id,actor,action,target,target_type,detail)
values(null,'system','schema_migration','dispatch_events,rider_offers,dispatch_assignment_events','table',
       'migration_093: delivery dispatch integrity — vendor-ready event, server-side rider matching, expiring rider offers, atomic acceptance/reassignment, vendor/customer notifications, and realtime assignment event ledger.');

-- When a rider comes online after a ready-order event was already exhausted,
-- give the rider a chance to enter the matcher. This avoids a permanent
-- dispatch dead-end caused solely by timing (vendor ready while every rider
-- was offline). The rider is still offered only through the same server ledger.
create or replace function request_rider_dispatch()
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_uid uuid:=auth.uid(); v_rider riders%rowtype; v_order record; v_event dispatch_events%rowtype; v_new integer:=0;
begin
  if v_uid is null then return jsonb_build_object('success',false,'error','Authentication required'); end if;
  select * into v_rider from riders where user_id=v_uid and is_active=true and is_online=true for update;
  if not found then return jsonb_build_object('success',false,'error','Active online rider not found'); end if;

  for v_order in
    select o.id from orders o
    where o.status='ready' and o.rider_id is null and o.village_id=v_rider.village_id
      and not exists (select 1 from rider_offers ro where ro.order_id=o.id and ro.rider_id=v_rider.id and ro.status in ('offered','accepted'))
    order by o.ready_at nulls last, o.created_at
    limit 10
  loop
    select * into v_event from dispatch_events where order_id=v_order.id and event_type='ready_order' for update;
    if found and v_event.status in ('exhausted','waiting_for_rider') then
      -- helper excludes previously offered riders, but includes this newly online rider.
      v_new := v_new + _dispatch_offer_next_batch(v_event.id,3);
    end if;
  end loop;
  return jsonb_build_object('success',true,'new_offers',v_new);
end;
$$;
grant execute on function request_rider_dispatch() to authenticated;

insert into audit_log(actor_id,actor,action,target,target_type,detail)
values(null,'system','dispatch_hardening','request_rider_dispatch','rpc',
       'migration_093: riders coming online can enter existing ready-order dispatches without bypassing the offer ledger.');
