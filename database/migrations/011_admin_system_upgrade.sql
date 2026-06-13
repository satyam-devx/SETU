-- ════════════════════════════════════════════════════════════
-- Migration 011: Admin System Upgrade
-- Adds missing tables & indexes required by the upgraded
-- admin panel (audit log, broadcast log, notification queue,
-- platform feature flags, platform settings v2, disputes v2)
-- Safe to re-run (all DDL is idempotent).
-- ════════════════════════════════════════════════════════════

-- ── 1. Audit log (admin action trail) ───────────────────────
create table if not exists audit_log (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        references profiles(id) on delete set null,
  actor       text        not null default 'admin',  -- 'admin'|'system'|'super_admin'
  action      text        not null,                   -- e.g. 'ban_user', 'approve_vendor'
  target      text,                                   -- target entity id (string for flexibility)
  target_type text,                                   -- 'user'|'vendor'|'order'|'kyc' etc.
  detail      text,                                   -- freeform note / reason
  ip          text,                                   -- optional: caller IP
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_actor_id   on audit_log(actor_id);
create index if not exists idx_audit_log_action      on audit_log(action);
create index if not exists idx_audit_log_created_at  on audit_log(created_at desc);
create index if not exists idx_audit_log_target      on audit_log(target);

-- RLS: only admins may read; insert is allowed from service role / rpc
alter table audit_log enable row level security;

drop policy if exists "audit_log_read_admin" on audit_log;
create policy "audit_log_read_admin" on audit_log
  for select using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

drop policy if exists "audit_log_insert_admin" on audit_log;
create policy "audit_log_insert_admin" on audit_log
  for insert with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- ── 2. Platform settings (key-value store with type + meta) ──
create table if not exists platform_settings (
  key           text        primary key,
  value         jsonb       not null,
  data_type     text        not null default 'string', -- 'string'|'number'|'boolean'|'json'
  label         text,
  description   text,
  group_name    text        default 'general',          -- logical grouping
  is_public     boolean     not null default false,     -- exposed to client?
  updated_by    uuid        references profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create index if not exists idx_platform_settings_group on platform_settings(group_name);

alter table platform_settings enable row level security;

drop policy if exists "settings_read_admin" on platform_settings;
create policy "settings_read_admin" on platform_settings
  for select using (
    is_public
    or exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

drop policy if exists "settings_write_admin" on platform_settings;
create policy "settings_write_admin" on platform_settings
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- Seed default platform settings (idempotent)
insert into platform_settings (key, value, data_type, label, description, group_name, is_public)
values
  ('platform_name',           '"SETU"',                   'string',  'Platform Name',          'Displayed throughout the app',                   'branding',  true),
  ('platform_fee_pct',        '5',                         'number',  'Platform Fee (%)',        'Percentage deducted from each order',             'financials',false),
  ('min_order_amount',        '30',                        'number',  'Minimum Order Amount',    'Minimum cart total to place an order (₹)',        'orders',    true),
  ('delivery_radius_km',      '5',                         'number',  'Delivery Radius (km)',    'Max rider delivery distance',                     'operations',false),
  ('cod_deposit_required',    'true',                      'boolean', 'COD Deposit Required',   'Require vendor COD deposit before going live',    'financials',false),
  ('kyc_required_vendor',     'true',                      'boolean', 'KYC Required (Vendor)',  'Block vendor from going live without KYC',        'kyc',       false),
  ('kyc_required_rider',      'true',                      'boolean', 'KYC Required (Rider)',   'Block rider without KYC approval',                'kyc',       false),
  ('max_active_orders_rider', '3',                         'number',  'Max Orders per Rider',   'Concurrent delivery limit per rider',             'operations',false),
  ('wallet_enabled',          'true',                      'boolean', 'Wallet Enabled',         'Allow wallet payments',                           'features',  true),
  ('credit_enabled',          'true',                      'boolean', 'Credit Enabled',         'Allow credit / BNPL payments',                   'features',  true),
  ('maintenance_mode',        'false',                     'boolean', 'Maintenance Mode',       'Show maintenance screen to all non-admin users',  'features',  true),
  ('support_phone',           '"+911234567890"',           'string',  'Support Phone',          'Customer support WhatsApp / phone number',        'branding',  true),
  ('auto_assign_rider',       'true',                      'boolean', 'Auto-Assign Rider',      'Automatically assign nearest online rider',       'operations',false),
  ('referral_enabled',        'false',                     'boolean', 'Referral Program',       'Enable referral bonus system',                   'features',  true),
  ('setu_score_enabled',      'true',                      'boolean', 'Setu Score',             'Show setu score in user and vendor profiles',     'features',  true)
on conflict (key) do nothing;

-- ── 3. Notification broadcast log ────────────────────────────
create table if not exists notification_broadcasts (
  id           uuid        primary key default gen_random_uuid(),
  actor_id     uuid        references profiles(id) on delete set null,
  title        text        not null,
  body         text        not null,
  type         text        not null default 'system',
  target_role  text,           -- null = all users
  village_id   uuid        references villages(id) on delete set null,
  data         jsonb,
  sent_count   integer     not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_notification_broadcasts_created_at on notification_broadcasts(created_at desc);

alter table notification_broadcasts enable row level security;

drop policy if exists "notif_broadcast_admin" on notification_broadcasts;
create policy "notif_broadcast_admin" on notification_broadcasts
  for all using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'super_admin')
    )
  );

-- ── 4. Disputes: add resolution & resolved_at columns ────────
alter table disputes add column if not exists resolution   text;
alter table disputes add column if not exists resolved_at  timestamptz;
alter table disputes add column if not exists resolved_by  uuid references profiles(id) on delete set null;

create index if not exists idx_disputes_status     on disputes(status);
create index if not exists idx_disputes_created_at on disputes(created_at desc);

-- ── 5. Vendors: ensure is_active column exists ────────────────
alter table vendors add column if not exists is_active boolean not null default true;
create index if not exists idx_vendors_is_active    on vendors(is_active);
create index if not exists idx_vendors_is_verified  on vendors(is_verified);
create index if not exists idx_vendors_kyc_status   on vendors(kyc_status);

-- ── 6. Profiles: ensure is_verified tracks ban status ─────────
-- is_verified = false means banned/inactive for non-vendor roles
create index if not exists idx_profiles_role        on profiles(role);
create index if not exists idx_profiles_is_verified on profiles(is_verified);
create index if not exists idx_profiles_created_at  on profiles(created_at desc);

-- ── 7. Orders: performance indexes ───────────────────────────
create index if not exists idx_orders_status         on orders(status);
create index if not exists idx_orders_village        on orders(village);
create index if not exists idx_orders_vendor_id      on orders(vendor_id);
create index if not exists idx_orders_customer_id    on orders(customer_id);
create index if not exists idx_orders_rider_id       on orders(rider_id);
create index if not exists idx_orders_payment_method on orders(payment_method);

-- ── 8. Products: performance indexes ─────────────────────────
create index if not exists idx_products_vendor_id    on products(vendor_id);
create index if not exists idx_products_category_id  on products(category_id);
create index if not exists idx_products_is_available on products(is_available);

-- ── 9. KYC records: target-type index ────────────────────────
create index if not exists idx_kyc_records_status    on kyc_records(status);
create index if not exists idx_kyc_records_user_id   on kyc_records(user_id);

-- ── 10. RPC: get live admin analytics ────────────────────────
create or replace function get_live_admin_analytics()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
  today_start timestamptz := date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
begin
  select json_build_object(
    -- Live operational
    'active_orders',      (select count(*) from orders where status not in ('delivered','cancelled')),
    'online_riders',      (select count(*) from riders where is_online = true and is_active = true),
    'open_vendors',       (select count(*) from vendors where is_open = true and is_active = true and is_verified = true),
    'pending_assign',     (select count(*) from orders where status in ('pending','confirmed','preparing','ready') and rider_id is null),
    'open_tickets',       (select count(*) from disputes where status in ('open','under_review','escalated')),

    -- Today summary
    'today_total',        (select count(*) from orders where created_at >= today_start),
    'today_delivered',    (select count(*) from orders where created_at >= today_start and status = 'delivered'),
    'today_cancelled',    (select count(*) from orders where created_at >= today_start and status = 'cancelled'),
    'today_revenue',      (select coalesce(sum(total),0) from orders where created_at >= today_start and status != 'cancelled'),
    'today_platform_fee', (select coalesce(sum(platform_fee),0) from orders where created_at >= today_start and status = 'delivered'),

    -- Platform totals
    'total_orders',       (select count(*) from orders),
    'total_gmv',          (select coalesce(sum(total),0) from orders where status = 'delivered'),
    'total_customers',    (select count(*) from profiles where role = 'customer'),
    'verified_vendors',   (select count(*) from vendors where is_verified = true and is_active = true),
    'pending_approval',   (select count(*) from vendors where is_verified = false and kyc_status != 'rejected'),
    'active_riders',      (select count(*) from riders where is_active = true),
    'new_today',          (select count(*) from profiles where created_at >= today_start),

    -- Financial
    'total_cod_held',     (select coalesce(sum(cod_deposit_amount),0) from vendors where is_active = true),
    'total_outstanding',  (select coalesce(sum(credit_outstanding),0) from profiles where credit_outstanding > 0),

    -- Payment mix (all-time)
    'cod_orders',         (select count(*) from orders where payment_method = 'cod'),
    'upi_orders',         (select count(*) from orders where payment_method = 'upi'),
    'wallet_orders',      (select count(*) from orders where payment_method = 'wallet'),
    'credit_orders',      (select count(*) from orders where payment_method = 'credit')
  ) into result;

  return result;
end;
$$;

-- ── 11. RPC: update order status (admin override) ────────────
create or replace function update_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_note       text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only admin/super_admin can call this
  if not exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin','super_admin')
  ) then
    raise exception 'Unauthorized';
  end if;

  update orders
  set    status     = p_new_status,
         updated_at = now()
  where  id = p_order_id;

  -- Write audit trail
  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), 'admin', 'update_order_status', p_order_id::text, 'order',
          coalesce(p_note, 'Status → ' || p_new_status));
end;
$$;

-- ── 12. Grant execute on RPCs to authenticated ───────────────
grant execute on function get_live_admin_analytics()      to authenticated;
grant execute on function update_order_status(uuid,text,text) to authenticated;


-- ── 13. Extend ban_user / unban_user RPCs to write audit log ──
create or replace function ban_user(
  p_user_id uuid,
  p_reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')
  ) then raise exception 'Unauthorized'; end if;

  update profiles set is_verified = false where id = p_user_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), 'admin', 'ban_user', p_user_id::text, 'user', p_reason);
end;
$$;

create or replace function unban_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from profiles where id = auth.uid() and role in ('admin','super_admin')
  ) then raise exception 'Unauthorized'; end if;

  update profiles set is_verified = true where id = p_user_id;

  insert into audit_log (actor_id, actor, action, target, target_type, detail)
  values (auth.uid(), 'admin', 'unban_user', p_user_id::text, 'user', null);
end;
$$;

grant execute on function ban_user(uuid, text)  to authenticated;
grant execute on function unban_user(uuid)      to authenticated;
