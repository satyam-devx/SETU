-- SETU Phase 6 — Address / Serviceability Integrity
-- Adds immutable address binding and server-side serviceability.

create table if not exists delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  village_id text references villages(id) on delete set null,
  center_lat numeric(10,6),
  center_lng numeric(10,6),
  radius_km numeric(8,3) not null default 5 check (radius_km > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_delivery_zones_village on delivery_zones(village_id);
create index if not exists idx_delivery_zones_active on delivery_zones(is_active);

create table if not exists vendor_service_zones (
  vendor_id uuid not null references vendors(id) on delete cascade,
  zone_id uuid not null references delivery_zones(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (vendor_id, zone_id)
);
create index if not exists idx_vendor_service_zones_zone on vendor_service_zones(zone_id, is_active);

create table if not exists rider_service_zones (
  rider_id uuid not null references riders(id) on delete cascade,
  zone_id uuid not null references delivery_zones(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (rider_id, zone_id)
);
create index if not exists idx_rider_service_zones_zone on rider_service_zones(zone_id, is_active);


-- Lock serviceability tables: customers may read active zones, while only
-- admin/service-role may change zone definitions and vendor/rider mappings.
alter table delivery_zones enable row level security;
alter table vendor_service_zones enable row level security;
alter table rider_service_zones enable row level security;
drop policy if exists delivery_zones_active_read on delivery_zones;
create policy delivery_zones_active_read on delivery_zones for select to authenticated using (is_active or is_admin());
drop policy if exists vendor_service_zones_read on vendor_service_zones;
create policy vendor_service_zones_read on vendor_service_zones for select to authenticated using (is_active or is_admin());
drop policy if exists rider_service_zones_read on rider_service_zones;
create policy rider_service_zones_read on rider_service_zones for select to authenticated using (is_active or is_admin());
revoke insert, update, delete on delivery_zones, vendor_service_zones, rider_service_zones from authenticated, anon;

alter table customer_addresses add column if not exists zone_id uuid references delivery_zones(id) on delete set null;
alter table customer_addresses add column if not exists village_id text references villages(id) on delete set null;
alter table customer_addresses add column if not exists lat numeric(10,6);
alter table customer_addresses add column if not exists lng numeric(10,6);

alter table orders add column if not exists address_id uuid references customer_addresses(id) on delete set null;
alter table orders add column if not exists delivery_zone_id uuid references delivery_zones(id) on delete set null;
alter table orders add column if not exists delivery_address_snapshot jsonb;
create index if not exists idx_orders_address_id on orders(address_id);
create index if not exists idx_orders_delivery_zone on orders(delivery_zone_id);

create or replace function set_customer_address_context()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and new.village_id is null then
    select village_id into new.village_id from profiles where id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_customer_address_context on customer_addresses;
create trigger trg_customer_address_context
before insert or update on customer_addresses
for each row execute function set_customer_address_context();

-- Backfill village context for existing addresses from their owners.
update customer_addresses ca
set village_id = p.village_id
from profiles p
where p.id = ca.user_id and ca.village_id is null;

-- One default delivery zone per active village gives existing SETU data a safe
-- serviceability baseline. Admins can add smaller/radius zones later.
insert into delivery_zones(name, village_id, center_lat, center_lng, radius_km)
select 'Village: ' || v.name, v.id, v.lat, v.lng, 5
from villages v
where v.is_active
on conflict (name) do nothing;

insert into vendor_service_zones(vendor_id, zone_id)
select ven.id, dz.id
from vendors ven
join delivery_zones dz on dz.village_id = ven.village_id
where ven.village_id is not null
on conflict (vendor_id, zone_id) do nothing;

insert into rider_service_zones(rider_id, zone_id)
select r.id, dz.id
from riders r
join delivery_zones dz on dz.village_id = r.village_id
where r.village_id is not null
on conflict (rider_id, zone_id) do nothing;

create or replace function verify_address_ownership(p_address_id uuid)
returns customer_addresses
language plpgsql security definer set search_path = public as $$
declare v_address customer_addresses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_address from customer_addresses where id = p_address_id and user_id = auth.uid();
  if not found then raise exception 'Address not found or not owned by current customer'; end if;
  return v_address;
end;
$$;
revoke all on function verify_address_ownership(uuid) from public, anon;
grant execute on function verify_address_ownership(uuid) to authenticated;

create or replace function set_address_zone(p_address_id uuid, p_zone_id uuid, p_lat numeric default null, p_lng numeric default null)
returns customer_addresses
language plpgsql security definer set search_path = public as $$
declare v_address customer_addresses%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update customer_addresses set zone_id=p_zone_id, lat=p_lat, lng=p_lng, updated_at=now()
   where id=p_address_id and user_id=auth.uid() returning * into v_address;
  if not found then raise exception 'Address not found or not owned by current customer'; end if;
  if not exists (select 1 from delivery_zones where id=p_zone_id and is_active) then raise exception 'Invalid or inactive delivery zone'; end if;
  if p_lat is not null and p_lng is not null and not exists (
    select 1 from delivery_zones dz where dz.id=p_zone_id and
      (dz.center_lat is null or dz.center_lng is null or
       111.045 * sqrt(power(p_lat-dz.center_lat,2)+power((p_lng-dz.center_lng)*cos(radians(dz.center_lat)),2)) <= dz.radius_km)
  ) then raise exception 'Address coordinates are outside the selected delivery zone'; end if;
  return v_address;
end;
$$;
revoke all on function set_address_zone(uuid,uuid,numeric,numeric) from public, anon;
grant execute on function set_address_zone(uuid,uuid,numeric,numeric) to authenticated;

create or replace function create_order(
  p_vendor_id       uuid,
  p_items           jsonb,
  p_payment_method  text    default 'COD',
  p_delivery_address text   default null,
  p_village_id      text    default null,
  p_delivery_notes  text    default null,
  p_use_credit      boolean default false,
  p_coupon_code     text    default null,
  p_idempotency_key text    default null,
  p_address_id      uuid    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid             uuid := auth.uid();
  v_customer_name   text;
  v_vendor          vendors%rowtype;
  v_item            jsonb;
  v_product         products%rowtype;
  v_qty             integer;
  v_subtotal        numeric(10,2) := 0;
  v_credit_discount numeric(10,2) := 0;
  v_coupon_discount numeric(10,2) := 0;
  v_coupon_id       uuid;
  v_coupon          jsonb;
  v_final           numeric(10,2);
  v_delivery_fee    numeric(10,2);
  v_platform_fee    numeric(10,2);
  v_total           numeric(10,2);
  v_order_id        uuid;
  v_order_number    text;
  v_credit          credit_accounts%rowtype;
  v_available       numeric(12,2);
  v_rows            integer;
  v_cfg             jsonb := get_fee_config();
  v_lock_id         uuid;
  v_existing        record;
  v_address         customer_addresses%rowtype;
  v_zone             delivery_zones%rowtype;
  v_snapshot        jsonb;
  v_address_text    text;
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
  end if;

  -- NEW (migration 083): idempotent replay — if this exact
  -- (customer, key) pair already produced an order, return it as-is
  -- rather than creating a second one. Checked before any validation
  -- below runs, so a retried request can't fail validation
  -- differently the second time and land in a confusing in-between
  -- state either.
  if p_idempotency_key is not null then
    select id, order_number, status, payment_status, payment_method,
           vendor_id, vendor_name, subtotal, coupon_discount,
           delivery_fee, platform_fee, total
      into v_existing
      from orders
     where customer_id = v_uid
       and idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'success', true, 'id', v_existing.id, 'order_number', v_existing.order_number,
        'status', v_existing.status, 'payment_status', v_existing.payment_status,
        'payment_method', v_existing.payment_method,
        'vendor_id', v_existing.vendor_id, 'vendor_name', v_existing.vendor_name,
        'subtotal', v_existing.subtotal, 'credit_discount', 0, 'coupon_discount', v_existing.coupon_discount,
        'delivery_fee', v_existing.delivery_fee, 'platform_fee', v_existing.platform_fee, 'total', v_existing.total,
        'replayed', true
      );
    end if;
  end if;

  if p_payment_method not in ('COD', 'UPI', 'wallet', 'credit') then
    return jsonb_build_object('success', false, 'error', 'Invalid payment method');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('success', false, 'error', 'Order must contain at least one item');
  end if;

  select * into v_vendor from vendors where id = p_vendor_id;
  if not found or not v_vendor.is_active then
    return jsonb_build_object('success', false, 'error', 'Vendor not available');
  end if;
  if not v_vendor.is_open then
    return jsonb_build_object('success', false, 'error', 'This shop is currently closed. Please try again when they reopen.');
  end if;

  -- Phase 6: an order must bind to an address owned by the authenticated customer.
  if p_address_id is null then
    return jsonb_build_object('success', false, 'error', 'A saved delivery address is required');
  end if;

  select * into v_address
    from customer_addresses
   where id = p_address_id
     and user_id = v_uid;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Delivery address does not belong to this customer');
  end if;

  -- Serviceability is server-authoritative. Address zone is explicit when set;
  -- otherwise the address village must resolve to an active delivery zone.
  if v_address.zone_id is not null then
    select * into v_zone from delivery_zones where id = v_address.zone_id and is_active
      and (village_id is null or village_id = v_address.village_id or v_address.village_id is null);
  else
    select dz.* into v_zone
      from delivery_zones dz
     where dz.is_active
       and (dz.village_id is null or dz.village_id = coalesce(v_address.village_id, p_village_id, v_vendor.village_id))
       and (v_address.lat is null or v_address.lng is null or
            111.045 * sqrt(power(v_address.lat - dz.center_lat, 2) +
              power((v_address.lng - dz.center_lng) * cos(radians(dz.center_lat)), 2)) <= dz.radius_km)
     order by case when dz.village_id = coalesce(v_address.village_id, p_village_id, v_vendor.village_id) then 0 else 1 end, dz.radius_km
     limit 1;
  end if;
  if not found then
    return jsonb_build_object('success', false, 'error', 'This delivery address is outside SETU service area');
  end if;

  if not exists (
    select 1 from vendor_service_zones vsz
     where vsz.vendor_id = v_vendor.id and vsz.zone_id = v_zone.id and vsz.is_active
  ) then
    return jsonb_build_object('success', false, 'error', 'This vendor does not currently deliver to the selected address');
  end if;

  v_address_text := concat_ws(', ', nullif(v_address.address,''), nullif(v_address.landmark,''));
  v_snapshot := jsonb_build_object(
    'address_id', v_address.id, 'label', v_address.label,
    'address', v_address.address, 'landmark', v_address.landmark,
    'village_id', v_address.village_id,
    'latitude', v_address.lat, 'longitude', v_address.lng,
    'zone_id', v_zone.id, 'zone_name', v_zone.name,
    'verified_owner_id', v_uid, 'snapshotted_at', now()
  );

  select name into v_customer_name from profiles where id = v_uid;
  v_order_number := 'SETU-' || to_char(nextval('order_number_seq'), 'FM000000');

  insert into orders (
    id, order_number, customer_id, customer_name,
    vendor_id, vendor_name, village_id, village,
    status, payment_method, payment_status,
    subtotal, delivery_fee, platform_fee, total,
    is_cod, delivery_address, delivery_notes, idempotency_key, address_id, delivery_zone_id, delivery_address_snapshot
  ) values (
    gen_random_uuid(), v_order_number, v_uid, coalesce(v_customer_name, 'Customer'),
    v_vendor.id, v_vendor.name, coalesce(v_address.village_id, p_village_id, v_vendor.village_id), v_vendor.village,
    'pending', p_payment_method, 'pending',
    0, 0, 0, 0,
    (p_payment_method = 'COD'), coalesce(v_address_text, p_delivery_address), p_delivery_notes, p_idempotency_key, v_address.id, v_zone.id, v_snapshot
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'qty')::integer, 0);
    if v_qty <= 0 then raise exception 'Invalid quantity for item %', v_item->>'product_id'; end if;

    select * into v_product from products where id = (v_item->>'product_id')::uuid;
    if not found then raise exception 'Product % not found', v_item->>'product_id'; end if;
    if v_product.vendor_id <> p_vendor_id then raise exception 'Product % does not belong to this vendor', v_product.id; end if;
    if not v_product.is_available then raise exception 'Product "%" is not available', v_product.name; end if;

    update products set stock = stock - v_qty, updated_at = now()
     where id = v_product.id and stock >= v_qty;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then raise exception 'Insufficient stock for "%": only % left', v_product.name, v_product.stock; end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);
    insert into order_items (order_id, product_id, name, qty, price)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_product.price);
  end loop;

  -- ── Coupon (server-validated; raises with the reason if invalid) ──
  if p_coupon_code is not null and length(trim(p_coupon_code)) > 0 then
    select id into v_lock_id
      from coupons
     where upper(code) = upper(trim(p_coupon_code))
     for update;

    v_coupon := _evaluate_coupon(p_coupon_code, v_subtotal, p_vendor_id, v_uid);
    if not (v_coupon->>'valid')::boolean then
      raise exception '%', coalesce(v_coupon->>'reason', 'Invalid coupon');
    end if;
    v_coupon_discount := (v_coupon->>'discount')::numeric;
    v_coupon_id       := (v_coupon->>'coupon_id')::uuid;
  end if;

  -- ── Backed SETU Credit discount (config-driven) ──
  if p_use_credit then
    select * into v_credit from credit_accounts where user_id = v_uid;
    if not found or v_credit.status <> 'active' then
      raise exception 'SETU Credit is not available on your account';
    end if;
    v_credit_discount := least(
      round(v_subtotal * (v_cfg->>'credit_discount_pct')::numeric / 100, 2),
      (v_cfg->>'credit_discount_max')::numeric
    );
    v_available := v_credit.credit_limit - v_credit.outstanding;
    if v_available < v_credit_discount then
      raise exception 'Insufficient SETU Credit (available ₹%)', v_available;
    end if;
    update credit_accounts set outstanding = outstanding + v_credit_discount, updated_at = now() where id = v_credit.id;
    insert into credit_transactions (account_id, user_id, type, amount, purpose, status)
    values (v_credit.id, v_uid, 'disbursement', v_credit_discount, 'Order discount ' || v_order_number, 'active');
  end if;

  -- ── Fees ── (discounts never push the final below zero)
  v_final        := greatest(0, v_subtotal - v_credit_discount - v_coupon_discount);
  v_delivery_fee := case when v_subtotal >= (v_cfg->>'free_threshold')::numeric then 0 else (v_cfg->>'delivery_flat')::numeric end;
  v_platform_fee := round(v_final * (v_cfg->>'commission_pct')::numeric / 100);
  v_total        := v_final + v_delivery_fee + v_platform_fee;

  update orders set
    subtotal = v_subtotal, delivery_fee = v_delivery_fee, platform_fee = v_platform_fee, total = v_total,
    coupon_code = case when v_coupon_id is not null then upper(trim(p_coupon_code)) else null end,
    coupon_discount = v_coupon_discount, updated_at = now()
  where id = v_order_id;

  if v_coupon_id is not null then
    insert into coupon_redemptions (coupon_id, user_id, order_id, discount)
    values (v_coupon_id, v_uid, v_order_id, v_coupon_discount);
    update coupons set used_count = used_count + 1, updated_at = now() where id = v_coupon_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (v_uid, coalesce(v_customer_name, 'customer'), 'order_created', v_order_number,
    format('subtotal=₹%s credit=₹%s coupon=₹%s delivery=₹%s platform=₹%s total=₹%s method=%s zone=%s',
           v_subtotal, v_credit_discount, v_coupon_discount, v_delivery_fee, v_platform_fee, v_total, p_payment_method, v_zone.id));

  return jsonb_build_object(
    'success', true, 'id', v_order_id, 'order_number', v_order_number,
    'status', 'pending', 'payment_status', 'pending', 'payment_method', p_payment_method,
    'vendor_id', v_vendor.id, 'vendor_name', v_vendor.name,
    'subtotal', v_subtotal, 'credit_discount', v_credit_discount, 'coupon_discount', v_coupon_discount,
    'delivery_fee', v_delivery_fee, 'platform_fee', v_platform_fee, 'total', v_total,
    'address_id', v_address.id, 'delivery_zone_id', v_zone.id
  );
end;
$$;

insert into audit_log(actor_id,actor,action,target,detail) values (null,'system','security_migration','address_serviceability','Phase 6: customer-owned address binding, delivery zones, vendor/rider service zones, and immutable order address snapshots.');

-- Dispatch matching now respects the customer's immutable delivery zone and
-- rider's explicitly assigned service zones; village matching remains the
-- compatibility fallback for legacy riders without a zone mapping.
create or replace function _dispatch_offer_next_batch(p_dispatch_id uuid, p_limit integer default 3)
returns integer language plpgsql security definer set search_path=public as $$
declare
  v_event dispatch_events%rowtype; v_order orders%rowtype; v_vendor vendors%rowtype;
  v_count integer := 0; v_rider record;
begin
  select * into v_event from dispatch_events where id=p_dispatch_id for update;
  if not found then return 0; end if;
  select * into v_order from orders where id=v_event.order_id for update;
  if not found or v_order.status <> 'ready' or v_order.rider_id is not null then
    update dispatch_events set status='cancelled', processed_at=coalesce(processed_at,now()) where id=p_dispatch_id; return 0;
  end if;
  select * into v_vendor from vendors where id=v_order.vendor_id;
  for v_rider in
    select r.id, r.name, coalesce(loc.lat, v_vendor.lat) lat, coalesce(loc.lng, v_vendor.lng) lng,
      case when loc.lat is not null and v_vendor.lat is not null and loc.lng is not null and v_vendor.lng is not null then
        6371 * 2 * asin(sqrt(power(sin(radians((loc.lat-v_vendor.lat)/2)),2)+cos(radians(v_vendor.lat))*cos(radians(loc.lat))*power(sin(radians((loc.lng-v_vendor.lng)/2)),2)))
      else 999999 end distance_km
    from riders r
    left join lateral (select rl.lat,rl.lng from rider_locations rl where rl.rider_id=r.id and rl.recorded_at >= now()-interval '10 minutes' order by rl.recorded_at desc limit 1) loc on true
    where r.is_active and r.is_verified and r.is_online
      and (v_order.delivery_zone_id is null or exists(select 1 from rider_service_zones rsz where rsz.rider_id=r.id and rsz.zone_id=v_order.delivery_zone_id and rsz.is_active)
           or (not exists(select 1 from rider_service_zones rsz0 where rsz0.rider_id=r.id and rsz0.is_active) and (r.village_id=v_order.village_id or v_order.village_id is null)))
      and not exists(select 1 from orders ao where ao.rider_id=r.id and ao.status in ('picked_up','on_the_way'))
      and not exists(select 1 from rider_offers ro where ro.dispatch_event_id=v_event.id and ro.rider_id=r.id)
    order by distance_km asc, r.updated_at asc limit greatest(p_limit,1)
  loop
    insert into rider_offers(dispatch_event_id,order_id,rider_id,status,rank,expires_at) values(v_event.id,v_order.id,v_rider.id,'offered',v_event.attempt_no+v_count+1,now()+interval '45 seconds') on conflict (dispatch_event_id,rider_id) do nothing;
    if found then
      v_count:=v_count+1;
      insert into dispatch_assignment_events(order_id,rider_id,event_type,payload) values(v_order.id,v_rider.id,'offer_created',jsonb_build_object('dispatch_event_id',v_event.id,'expires_at',now()+interval '45 seconds','delivery_zone_id',v_order.delivery_zone_id));
      insert into notifications(user_id,type,title,body,data) select r.user_id,'order','New delivery offer',format('Order %s is ready for pickup. You have 45 seconds to accept.',v_order.order_number),jsonb_build_object('event','rider_offer','order_id',v_order.id,'offer_id',(select ro.id from rider_offers ro where ro.dispatch_event_id=v_event.id and ro.rider_id=v_rider.id order by ro.created_at desc limit 1)) from riders r where r.id=v_rider.id and r.user_id is not null;
    end if;
  end loop;
  update dispatch_events set status=case when v_count>0 then 'offering' else 'exhausted' end, attempt_no=attempt_no+1, updated_at=now() where id=v_event.id;
  return v_count;
end; $$;
revoke execute on function _dispatch_offer_next_batch(uuid,integer) from public,anon,authenticated;


-- Replace the previous 9-argument create_order overload with the Phase 6
-- 10-argument form. Migration 084 already removed the stale 8-argument form.
drop function if exists create_order(uuid, jsonb, text, text, text, text, boolean, text, text);
grant execute on function create_order(uuid, jsonb, text, text, text, text, boolean, text, text, uuid) to authenticated;
