-- ═══════════════════════════════════════════════════════════
-- SETU — Migration 009: Admin Feature Pack
-- Adds:
--   1. platform_config  — persisted key-value settings
--   2. banners          — homepage CMS banners
--   3. image_moderation — media approval queue
--   4. admin_analytics view  — live aggregated metrics
--   5. Security-definer helpers for config + user management
-- Run after schema.sql and rls.sql in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- 1. PLATFORM CONFIG  (key-value store for admin settings)
-- ─────────────────────────────────────────────────────────
create table if not exists platform_config (
  key         text primary key,
  value       text not null,
  description text,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- Seed defaults
insert into platform_config (key, value, description) values
  ('platform_commission_pct',   '1',    'Platform fee % added to every order'),
  ('rider_earning_per_delivery','25',   'Fixed ₹ paid to rider per delivery'),
  ('seva_platform_fee_pct',     '10',   'Platform fee % on seva jobs'),
  ('default_credit_limit',      '500',  'Starting SETU Credit limit for new customers (₹)'),
  ('max_cod_balance_rider',     '1000', 'Max cash a rider may hold before mandatory deposit (₹)'),
  ('order_cancel_window_min',   '10',   'Minutes customer can cancel after placing order'),
  ('vendor_approval_sla_hours', '48',   'SLA for admin to approve/reject a vendor (hours)'),
  ('maintenance_mode',          'false','Set true to show maintenance banner to all users'),
  ('new_registrations_enabled', 'true', 'Allow new user sign-ups'),
  ('delivery_fee_free_above',   '200',  'Orders above this amount get free delivery (₹)'),
  ('delivery_fee_default',      '20',   'Default delivery fee for orders below threshold (₹)'),
  ('alert_new_vendor',          'true', 'Push alert to admin on new vendor registration'),
  ('alert_fraud_flag',          'true', 'Push alert to admin when a fraud report is filed'),
  ('alert_cod_overdue',         'false','Push alert when rider COD not deposited in 24h'),
  ('require_2fa_admin',         'true', 'Require 2FA for admin logins'),
  ('auto_suspend_fraud',        'true', 'Auto-suspend accounts with 3+ fraud flags')
on conflict (key) do nothing;

-- RLS
alter table platform_config enable row level security;

create policy "config_admin_read"
  on platform_config for select
  using (is_admin());

create policy "config_admin_write"
  on platform_config for all
  using  (is_admin())
  with check (is_admin());

-- Security-definer so RPC can update config and stamp updated_by
create or replace function upsert_platform_config(
  p_key         text,
  p_value       text,
  p_description text default null
)
returns void as $$
begin
  insert into platform_config (key, value, description, updated_by, updated_at)
  values (p_key, p_value, coalesce(p_description, ''), auth.uid(), now())
  on conflict (key) do update
    set value      = excluded.value,
        updated_by = auth.uid(),
        updated_at = now();
end;
$$ language plpgsql security definer;

-- Bulk upsert for saving the whole settings form in one call
create or replace function upsert_platform_config_bulk(
  p_entries jsonb  -- [{"key":"...", "value":"..."}, ...]
)
returns void as $$
declare
  entry jsonb;
begin
  for entry in select * from jsonb_array_elements(p_entries)
  loop
    insert into platform_config (key, value, updated_by, updated_at)
    values (entry->>'key', entry->>'value', auth.uid(), now())
    on conflict (key) do update
      set value      = excluded.value,
          updated_by = auth.uid(),
          updated_at = now();
  end loop;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────
-- 2. BANNERS  (homepage CMS)
-- ─────────────────────────────────────────────────────────
create table if not exists banners (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  subtitle    text,
  image_url   text,
  link        text,                     -- internal route or external URL
  village_id  text references villages(id) on delete set null,  -- null = all villages
  sort_order  integer not null default 0,
  bg_color    text    not null default '#f97316',  -- CSS hex/hsl
  is_active   boolean not null default true,
  active_from timestamptz,
  active_to   timestamptz,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_banners_is_active   on banners(is_active);
create index if not exists idx_banners_village_id  on banners(village_id);
create index if not exists idx_banners_sort_order  on banners(sort_order);
create trigger trg_banners_updated_at before update on banners
  for each row execute function update_updated_at();

-- Seed sample banners
insert into banners (title, subtitle, link, bg_color, sort_order, is_active) values
  ('Chhath Puja Special 🪔', 'Up to 30% off on Thekua & Makhana', '/customer/vendors', '#f97316', 1, true),
  ('Free Delivery Today!', 'On all orders above ₹200', '/customer', '#16a34a', 2, true)
on conflict do nothing;

-- RLS
alter table banners enable row level security;

create policy "banners_public_read"
  on banners for select
  using (is_active = true and (active_from is null or active_from <= now())
                           and (active_to   is null or active_to   >= now()));

create policy "banners_admin_all"
  on banners for all
  using  (is_admin())
  with check (is_admin());

-- ─────────────────────────────────────────────────────────
-- 3. IMAGE MODERATION QUEUE
-- ─────────────────────────────────────────────────────────
create table if not exists image_moderation (
  id            uuid primary key default uuid_generate_v4(),
  storage_path  text not null,          -- Supabase Storage path
  public_url    text not null,
  entity_type   text not null           -- 'product', 'vendor', 'kyc', 'banner'
                  check (entity_type in ('product','vendor','kyc','banner')),
  entity_id     text,                   -- FK to the owning record (flexible text)
  uploaded_by   uuid references auth.users(id) on delete set null,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_image_mod_status      on image_moderation(status);
create index if not exists idx_image_mod_entity      on image_moderation(entity_type, entity_id);
create index if not exists idx_image_mod_created_at  on image_moderation(created_at desc);

-- RLS
alter table image_moderation enable row level security;

create policy "image_mod_admin_all"
  on image_moderation for all
  using  (is_admin())
  with check (is_admin());

create policy "image_mod_uploader_read"
  on image_moderation for select
  using (uploaded_by = auth.uid());

-- Security-definer review function
create or replace function review_image(
  p_image_id    uuid,
  p_status      text,   -- 'approved' or 'rejected'
  p_reason      text default null
)
returns void as $$
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;
  update image_moderation
    set status      = p_status,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        reject_reason = p_reason
  where id = p_image_id;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────
-- 4. ADMIN_ANALYTICS VIEW  (live aggregated metrics)
-- ─────────────────────────────────────────────────────────
create or replace view admin_analytics as
with
  today_orders as (
    select
      count(*)                                      as today_total,
      count(*) filter (where status = 'delivered') as today_delivered,
      count(*) filter (where status = 'cancelled') as today_cancelled,
      coalesce(sum(total) filter (where status = 'delivered'), 0) as today_revenue,
      coalesce(sum(platform_fee) filter (where status = 'delivered'), 0) as today_platform_fee
    from orders
    where created_at >= current_date
  ),
  all_orders as (
    select
      count(*) as total_orders,
      coalesce(sum(total) filter (where status = 'delivered'), 0) as total_gmv,
      count(*) filter (where status in ('pending','confirmed','preparing','ready','picked_up','on_the_way')) as active_orders,
      count(*) filter (where status = 'pending' and rider_id is null) as pending_assign
    from orders
  ),
  users_stats as (
    select
      count(*) filter (where role = 'customer')      as total_customers,
      count(*) filter (where role = 'vendor')        as total_vendors,
      count(*) filter (where role = 'rider')         as total_riders,
      count(*) filter (where role = 'seva_provider') as total_seva,
      count(*) filter (where created_at >= current_date) as new_today
    from profiles
  ),
  vendor_stats as (
    select
      count(*) filter (where is_verified = true)                   as verified_vendors,
      count(*) filter (where kyc_status = 'pending')               as pending_approval,
      count(*) filter (where is_open = true and is_active = true)  as open_vendors
    from vendors
  ),
  rider_stats as (
    select
      count(*) filter (where is_online = true and is_active = true) as online_riders,
      count(*) filter (where is_active = true)                      as active_riders,
      coalesce(sum(cod_balance), 0)                                  as total_cod_held
    from riders
  ),
  credit_stats as (
    select
      coalesce(sum(outstanding), 0)    as total_outstanding,
      coalesce(sum(credit_limit), 0)   as total_credit_limit,
      count(*) filter (where status = 'suspended') as suspended_accounts
    from credit_accounts
  ),
  support_stats as (
    select
      count(*) filter (where status = 'open')        as open_tickets,
      count(*) filter (where status = 'in_progress') as in_progress_tickets,
      count(*) filter (where priority = 'critical')  as critical_tickets
    from support_tickets
  ),
  payment_mix as (
    select
      count(*) filter (where payment_method = 'COD')    as cod_orders,
      count(*) filter (where payment_method = 'UPI')    as upi_orders,
      count(*) filter (where payment_method = 'wallet') as wallet_orders,
      count(*) filter (where payment_method = 'credit') as credit_orders
    from orders
    where status = 'delivered'
  )
select
  -- Today
  t.today_total,
  t.today_delivered,
  t.today_cancelled,
  t.today_revenue,
  t.today_platform_fee,
  -- All time
  a.total_orders,
  a.total_gmv,
  a.active_orders,
  a.pending_assign,
  -- Users
  u.total_customers,
  u.total_vendors,
  u.total_riders,
  u.total_seva,
  u.new_today,
  -- Vendors
  v.verified_vendors,
  v.pending_approval,
  v.open_vendors,
  -- Riders
  r.online_riders,
  r.active_riders,
  r.total_cod_held,
  -- Credit
  c.total_outstanding,
  c.total_credit_limit,
  c.suspended_accounts,
  -- Support
  s.open_tickets,
  s.in_progress_tickets,
  s.critical_tickets,
  -- Payment mix
  p.cod_orders,
  p.upi_orders,
  p.wallet_orders,
  p.credit_orders
from today_orders t
cross join all_orders a
cross join users_stats u
cross join vendor_stats v
cross join rider_stats r
cross join credit_stats c
cross join support_stats s
cross join payment_mix p;

-- ─────────────────────────────────────────────────────────
-- 5. DAILY_ORDER_TREND VIEW  (last 30 days for charts)
-- ─────────────────────────────────────────────────────────
create or replace view daily_order_trend as
select
  date_trunc('day', created_at)::date        as day,
  count(*)                                   as total_orders,
  count(*) filter (where status = 'delivered')  as delivered,
  count(*) filter (where status = 'cancelled')  as cancelled,
  coalesce(sum(total) filter (where status = 'delivered'), 0) as revenue
from orders
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- ─────────────────────────────────────────────────────────
-- 6. HOURLY_ORDER_TREND  (today by hour)
-- ─────────────────────────────────────────────────────────
create or replace view hourly_order_trend as
select
  extract(hour from created_at)::int as hr,
  count(*)                           as orders
from orders
where created_at >= current_date
group by 1
order by 1;

-- ─────────────────────────────────────────────────────────
-- 7. USER MANAGEMENT: ban / unban  (security-definer)
-- Sets profiles.is_verified=false to prevent platform use.
-- Does NOT disable Supabase Auth — use the Supabase dashboard
-- for hard auth ban. This is a soft ban at the profile level.
-- ─────────────────────────────────────────────────────────
create or replace function ban_user(p_user_id uuid, p_reason text default null)
returns void as $$
begin
  update profiles set is_verified = false where id = p_user_id;
  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), 'admin', 'ban_user', p_user_id::text, p_reason);
end;
$$ language plpgsql security definer;

create or replace function unban_user(p_user_id uuid)
returns void as $$
begin
  update profiles set is_verified = true where id = p_user_id;
  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), 'admin', 'unban_user', p_user_id::text, null);
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────
-- 8. ROLE ASSIGNMENT  (super_admin only, security-definer)
-- ─────────────────────────────────────────────────────────
create or replace function assign_role(p_user_id uuid, p_role text)
returns void as $$
begin
  if get_my_role() <> 'super_admin' then
    raise exception 'Only super_admin can assign roles';
  end if;
  if p_role not in ('customer','vendor','rider','seva_provider','anchor','admin','super_admin') then
    raise exception 'Invalid role: %', p_role;
  end if;
  update profiles set role = p_role where id = p_user_id;
  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), 'super_admin', 'assign_role', p_user_id::text, p_role);
end;
$$ language plpgsql security definer;

revoke execute on function assign_role(uuid, text) from authenticated;
grant  execute on function assign_role(uuid, text) to service_role;

-- ─────────────────────────────────────────────────────────
-- 9. CATEGORIES: allow admin full write via RLS
-- (already defined in rls.sql — this is a no-op if run again)
-- ─────────────────────────────────────────────────────────
-- The existing policy "categories_admin_write" covers INSERT/UPDATE/DELETE.
-- No additional SQL needed.

-- ─────────────────────────────────────────────────────────
-- 10. PRODUCTS ADMIN VIEW  (cross-vendor, with vendor name)
-- ─────────────────────────────────────────────────────────
create or replace view admin_products_view as
select
  p.id,
  p.vendor_id,
  v.name          as vendor_name,
  v.village       as vendor_village,
  p.category_id,
  c.name          as category_name,
  p.name,
  p.name_hindi,
  p.description,
  p.price,
  p.mrp,
  p.unit,
  p.stock,
  p.image_url,
  p.is_available,
  p.is_seasonal,
  p.created_at,
  p.updated_at
from products p
left join vendors v on v.id = p.vendor_id
left join categories c on c.id = p.category_id
order by p.updated_at desc;
