-- ═══════════════════════════════════════════════════════════════
-- Migration 019: Data & Ops Hardening (Phase 3)
--
-- Addresses audit Phase-3 / Phase-5 items:
--   1. FEE SINGLE SOURCE OF TRUTH
--        Fee math was duplicated and divergent: platform_config seeded
--        rider_earning_per_delivery=25, while compute_fee_split() and
--        update_order_status() hardcoded ₹80; create_order() hardcoded
--        1% / ₹20 / ₹200. Now ALL fee math reads get_fee_config(),
--        which reads platform_config with safe defaults. The defaults
--        preserve current effective behaviour exactly (1% / ₹20 / ₹200 /
--        ₹80 / 10% credit cap ₹500). rider_earning_per_delivery is
--        reconciled to the value actually in effect (80) — the seeded
--        25 was dead config no function ever read.  [Confirm with
--        product if 25 was the intended rider fee.]
--   2. CACHED ADMIN AGGREGATES
--        getAdminStats ran 4 full COUNT(*) scans per dashboard load;
--        getVillageStats pulled whole row sets to count in JS. Replaced
--        with a refreshed materialized view + indexed-count RPCs.
--   3. RETENTION
--        pg_cron prune jobs for high-growth, low-value tables
--        (notifications, payment_events, client_error_logs). audit_log
--        is intentionally NOT auto-deleted (compliance) — see note.
--   4. OBSERVABILITY
--        client_error_logs table for frontend error capture.
-- ═══════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════
-- PART 1 — FEE SINGLE SOURCE OF TRUTH
-- ════════════════════════════════════════════════════════════════

-- Canonical fee keys. The first four already exist (migration 010);
-- reconcile rider fee to the value actually in effect, add the credit
-- discount knobs. on conflict do update so re-runs are safe.
insert into platform_config (key, value, description) values
  ('platform_commission_pct',    '1',   'Platform fee % of (subtotal - credit discount)'),
  ('delivery_fee_default',       '20',  'Flat delivery fee below the free threshold (₹)'),
  ('delivery_fee_free_above',    '200', 'Subtotal at/above which delivery is free (₹)'),
  ('rider_earning_per_delivery', '80',  'Fixed ₹ credited to rider per delivered order'),
  ('credit_discount_pct',        '10',  'SETU Credit discount % of subtotal'),
  ('credit_discount_max',        '500', 'Max SETU Credit discount per order (₹)')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- get_fee_config(): the ONE place fee parameters are resolved. Reads
-- platform_config (security definer bypasses its admin-only RLS) and
-- returns only the non-sensitive fee numbers, so the frontend can use
-- the same source for its checkout estimate. Safe to expose.
create or replace function get_fee_config()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'commission_pct',      coalesce((select value from platform_config where key = 'platform_commission_pct'),    '1')::numeric,
    'delivery_flat',       coalesce((select value from platform_config where key = 'delivery_fee_default'),        '20')::numeric,
    'free_threshold',      coalesce((select value from platform_config where key = 'delivery_fee_free_above'),     '200')::numeric,
    'rider_fee',           coalesce((select value from platform_config where key = 'rider_earning_per_delivery'),  '80')::numeric,
    'credit_discount_pct', coalesce((select value from platform_config where key = 'credit_discount_pct'),         '10')::numeric,
    'credit_discount_max', coalesce((select value from platform_config where key = 'credit_discount_max'),         '500')::numeric
  );
$$;

grant execute on function get_fee_config() to anon, authenticated, service_role;

-- create_order: identical to migration 017 except every fee literal
-- now comes from get_fee_config(). Defaults preserve 017's behaviour.
create or replace function create_order(
  p_vendor_id       uuid,
  p_items           jsonb,
  p_payment_method  text    default 'COD',
  p_delivery_address text   default null,
  p_village_id      text    default null,
  p_delivery_notes  text    default null,
  p_use_credit      boolean default false
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
begin
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Authentication required');
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

  select name into v_customer_name from profiles where id = v_uid;

  v_order_number := 'SETU-' || to_char(nextval('order_number_seq'), 'FM000000');

  insert into orders (
    id, order_number, customer_id, customer_name,
    vendor_id, vendor_name, village_id, village,
    status, payment_method, payment_status,
    subtotal, delivery_fee, platform_fee, total,
    is_cod, delivery_address, delivery_notes
  ) values (
    uuid_generate_v4(), v_order_number, v_uid, coalesce(v_customer_name, 'Customer'),
    v_vendor.id, v_vendor.name, coalesce(p_village_id, v_vendor.village_id), v_vendor.village,
    'pending', p_payment_method, 'pending',
    0, 0, 0, 0,
    (p_payment_method = 'COD'), p_delivery_address, p_delivery_notes
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'qty')::integer, 0);
    if v_qty <= 0 then
      raise exception 'Invalid quantity for item %', v_item->>'product_id';
    end if;

    select * into v_product from products where id = (v_item->>'product_id')::uuid;

    if not found then
      raise exception 'Product % not found', v_item->>'product_id';
    end if;
    if v_product.vendor_id <> p_vendor_id then
      raise exception 'Product % does not belong to this vendor', v_product.id;
    end if;
    if not v_product.is_available then
      raise exception 'Product "%" is not available', v_product.name;
    end if;

    update products set stock = stock - v_qty, updated_at = now()
     where id = v_product.id and stock >= v_qty;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      raise exception 'Insufficient stock for "%": only % left', v_product.name, v_product.stock;
    end if;

    v_subtotal := v_subtotal + (v_product.price * v_qty);

    insert into order_items (order_id, product_id, name, qty, price)
    values (v_order_id, v_product.id, v_product.name, v_qty, v_product.price);
  end loop;

  -- Backed SETU Credit discount (config-driven %, cap).
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

    update credit_accounts
       set outstanding = outstanding + v_credit_discount, updated_at = now()
     where id = v_credit.id;

    insert into credit_transactions (account_id, user_id, type, amount, purpose, status)
    values (v_credit.id, v_uid, 'disbursement', v_credit_discount,
            'Order discount ' || v_order_number, 'active');
  end if;

  -- Fees — all from get_fee_config().
  v_final        := v_subtotal - v_credit_discount;
  v_delivery_fee := case when v_subtotal >= (v_cfg->>'free_threshold')::numeric
                         then 0 else (v_cfg->>'delivery_flat')::numeric end;
  v_platform_fee := round(v_final * (v_cfg->>'commission_pct')::numeric / 100);
  v_total        := v_final + v_delivery_fee + v_platform_fee;

  update orders set
    subtotal = v_subtotal, delivery_fee = v_delivery_fee,
    platform_fee = v_platform_fee, total = v_total, updated_at = now()
  where id = v_order_id;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    v_uid, coalesce(v_customer_name, 'customer'), 'order_created', v_order_number,
    format('subtotal=₹%s discount=₹%s delivery=₹%s platform=₹%s total=₹%s method=%s',
           v_subtotal, v_credit_discount, v_delivery_fee, v_platform_fee, v_total, p_payment_method)
  );

  return jsonb_build_object(
    'success', true, 'id', v_order_id, 'order_number', v_order_number,
    'status', 'pending', 'payment_status', 'pending', 'payment_method', p_payment_method,
    'vendor_id', v_vendor.id, 'vendor_name', v_vendor.name,
    'subtotal', v_subtotal, 'credit_discount', v_credit_discount,
    'delivery_fee', v_delivery_fee, 'platform_fee', v_platform_fee, 'total', v_total
  );
end;
$$;

grant execute on function create_order(uuid, jsonb, text, text, text, text, boolean) to authenticated;

-- record_delivery_split: pass the configured rider fee into the
-- (still pure/immutable) compute_fee_split, instead of its ₹80 default.
create or replace function record_delivery_split(
  p_order_id            uuid,
  p_razorpay_payment_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order      orders%rowtype;
  v_split      jsonb;
  v_vendor_amt numeric;
  v_platform   numeric;
  v_rider_earn numeric;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('success', false, 'error', 'Order not found');
  end if;

  if exists (select 1 from delivery_fee_splits where order_id = p_order_id) then
    return jsonb_build_object('success', true, 'skipped', true);
  end if;

  v_split := compute_fee_split(
    v_order.subtotal, v_order.delivery_fee, v_order.platform_fee,
    (get_fee_config()->>'rider_fee')::numeric
  );
  v_vendor_amt := (v_split->>'vendor_amount')::numeric;
  v_platform   := (v_split->>'platform_cut')::numeric;
  v_rider_earn := (v_split->>'rider_earning')::numeric;

  insert into delivery_fee_splits (
    order_id, order_total, subtotal, delivery_fee, platform_fee,
    vendor_amount, platform_cut, rider_earning, payment_method, razorpay_payment_id
  ) values (
    p_order_id, v_order.total, v_order.subtotal, v_order.delivery_fee, v_order.platform_fee,
    v_vendor_amt, v_platform, v_rider_earn, v_order.payment_method, p_razorpay_payment_id
  );

  insert into vendor_escrow (vendor_id, balance, total_credited)
  values (v_order.vendor_id, v_vendor_amt, v_vendor_amt)
  on conflict (vendor_id) do update
    set balance = vendor_escrow.balance + excluded.balance,
        total_credited = vendor_escrow.total_credited + excluded.total_credited,
        updated_at = now();

  insert into audit_log (actor_id, actor, action, target, detail)
  values (null, 'system', 'fee_split_recorded', v_order.order_number,
          format('vendor=₹%s platform=₹%s rider=₹%s', v_vendor_amt, v_platform, v_rider_earn));

  return jsonb_build_object('success', true, 'vendor_amount', v_vendor_amt,
                            'platform_cut', v_platform, 'rider_earning', v_rider_earn);
end;
$$;
revoke execute on function record_delivery_split(uuid, text) from authenticated, anon;

-- update_order_status: identical role-aware authz from migration 017;
-- the only change is the delivered-credit amount now comes from
-- get_fee_config() (rider_fee) instead of a hardcoded ₹80.
create or replace function update_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_actor_id   uuid  default null,
  p_meta       jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_role        text;
  v_order       orders%rowtype;
  v_allowed     text[];
  v_is_vendor   boolean := false;
  v_is_rider    boolean := false;
  v_is_customer boolean := false;
  v_is_admin    boolean := false;
  v_is_backend  boolean := (auth.uid() is null);
  v_role_allowed text[];
  v_apply_meta  boolean;
  v_rider_fee   numeric;
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('error', 'Order not found');
  end if;

  if not v_is_backend then
    v_role := get_my_role();
    v_is_admin := v_role in ('admin', 'super_admin');
    v_is_customer := (v_order.customer_id = v_uid);
    v_is_vendor := exists (select 1 from vendors where id = v_order.vendor_id and owner_id = v_uid);
    v_is_rider := v_order.rider_id is not null and exists (
      select 1 from riders where id = v_order.rider_id and user_id = v_uid
    );

    if not (v_is_admin or v_is_vendor or v_is_rider or v_is_customer) then
      return jsonb_build_object('error', 'Unauthorized: you cannot modify this order');
    end if;

    v_role_allowed := case
      when v_is_admin    then array['confirmed','preparing','ready','picked_up','on_the_way','delivered','cancelled']
      when v_is_vendor   then array['confirmed','preparing','ready','cancelled']
      when v_is_rider    then array['picked_up','on_the_way','delivered']
      when v_is_customer then array['cancelled']
      else array[]::text[]
    end;

    if not (p_new_status = any(v_role_allowed)) then
      return jsonb_build_object('error', format('Your role (%s) cannot set status %s', coalesce(v_role,'?'), p_new_status));
    end if;
  end if;

  v_allowed := case v_order.status
    when 'pending'    then array['confirmed','cancelled']
    when 'confirmed'  then array['preparing','cancelled']
    when 'preparing'  then array['ready']
    when 'ready'      then array['picked_up']
    when 'picked_up'  then array['on_the_way']
    when 'on_the_way' then array['delivered']
    else array[]::text[]
  end;

  if not (p_new_status = any(v_allowed)) then
    return jsonb_build_object('error', 'Invalid transition: ' || v_order.status || ' → ' || p_new_status);
  end if;

  v_apply_meta := v_is_admin or v_is_backend;

  update orders set
    status        = p_new_status,
    updated_at    = now(),
    confirmed_at  = case when p_new_status = 'confirmed'  then now() else confirmed_at  end,
    ready_at      = case when p_new_status = 'ready'      then now() else ready_at      end,
    picked_up_at  = case when p_new_status = 'picked_up'  then now() else picked_up_at  end,
    delivered_at  = case when p_new_status = 'delivered'  then now() else delivered_at  end,
    cancelled_at  = case when p_new_status = 'cancelled'  then now() else cancelled_at  end,
    cancel_reason = coalesce(p_meta->>'cancel_reason', cancel_reason),
    rider_id      = case when v_apply_meta then coalesce((p_meta->>'rider_id')::uuid, rider_id) else rider_id end,
    rider_name    = case when v_apply_meta then coalesce(p_meta->>'rider_name', rider_name) else rider_name end
  where id = p_order_id;

  if p_new_status = 'delivered' and v_order.rider_id is not null then
    v_rider_fee := (get_fee_config()->>'rider_fee')::numeric;
    update riders set
      today_deliveries = today_deliveries + 1,
      total_deliveries = total_deliveries + 1,
      today_earnings   = today_earnings + v_rider_fee,
      total_earnings   = total_earnings + v_rider_fee,
      cod_balance      = case when v_order.is_cod then cod_balance + v_order.total else cod_balance end
    where id = v_order.rider_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    v_uid,
    coalesce((select name from profiles where id = v_uid), case when v_is_backend then 'system' else 'user' end),
    'order_' || p_new_status,
    v_order.order_number,
    format('Status: %s → %s (by %s)', v_order.status, p_new_status,
           case when v_is_backend then 'backend' when v_is_admin then 'admin'
                when v_is_vendor then 'vendor' when v_is_rider then 'rider' else 'customer' end)
  );

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
end;
$$;
grant execute on function update_order_status(uuid, text, uuid, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- PART 2 — CACHED ADMIN AGGREGATES
-- ════════════════════════════════════════════════════════════════
-- getAdminStats() ran 4 separate full COUNT(*) scans on every admin
-- dashboard load. Replace with a materialized view refreshed on a
-- schedule + a security-definer accessor. Single constant-key row;
-- the unique index also leaves the door open to a CONCURRENTLY refresh
-- if it's ever driven from outside a transaction.

drop materialized view if exists admin_dashboard_stats;
create materialized view admin_dashboard_stats as
  select
    1 as id,
    (select count(*) from profiles)                                       as total_users,
    (select count(*) from orders)                                         as total_orders,
    (select count(*) from orders where status not in ('cancelled'))       as active_orders_total,
    (select coalesce(sum(total),0) from orders where status <> 'cancelled') as gmv,
    (select count(*) from vendors where is_active)                        as active_vendors,
    (select count(*) from riders  where is_active)                        as active_riders,
    (select count(*) from orders where created_at >= now() - interval '24 hours') as orders_24h,
    now() as refreshed_at;

create unique index if not exists idx_admin_dashboard_stats_id on admin_dashboard_stats (id);

-- Only the security-definer accessor reads it; no direct client grant.
revoke all on admin_dashboard_stats from authenticated, anon;

create or replace function refresh_admin_dashboard_stats()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Plain (non-concurrent) refresh: CONCURRENTLY cannot run inside a
  -- function/transaction, and this MV is a single tiny row, so the
  -- brief lock is negligible. Runs every 5 min via pg_cron.
  refresh materialized view admin_dashboard_stats;
end;
$$;

-- Admin-gated accessor — fast single-row read, no scans on request path.
create or replace function get_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin role required';
  end if;
  select to_jsonb(s) into v from admin_dashboard_stats s where s.id = 1;
  return coalesce(v, jsonb_build_object('stale', true));
end;
$$;
grant execute on function get_admin_stats() to authenticated;

-- Village dashboard stats — parameterised (can't MV per village), but
-- uses indexed COUNT/SUM done in SQL instead of pulling rows to JS.
-- Caller must be an admin or the anchor of that village.
create or replace function get_village_dashboard_stats(p_village_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not (
    is_admin()
    or (get_my_role() = 'anchor' and get_my_village_id() = p_village_id)
  ) then
    raise exception 'Unauthorized';
  end if;

  select jsonb_build_object(
    'totalOrders',   (select count(*) from orders where village_id = p_village_id),
    'activeOrders',  (select count(*) from orders where village_id = p_village_id and status not in ('delivered','cancelled')),
    'totalGMV',      (select coalesce(sum(total),0) from orders where village_id = p_village_id and status <> 'cancelled'),
    'totalVendors',  (select count(*) from vendors where village_id = p_village_id),
    'activeVendors', (select count(*) from vendors where village_id = p_village_id and is_open),
    'totalRiders',   (select count(*) from riders  where village_id = p_village_id),
    'onlineRiders',  (select count(*) from riders  where village_id = p_village_id and is_online),
    'pendingKYC',    (select count(*) from kyc_records k join profiles pr on pr.id = k.user_id
                       where pr.village_id = p_village_id and k.status in ('pending','submitted'))
  ) into v;
  return v;
end;
$$;
grant execute on function get_village_dashboard_stats(text) to authenticated;

-- Refresh the MV every 5 minutes (pg_cron upserts by job name).
select cron.schedule('refresh-admin-stats', '*/5 * * * *', $$ select refresh_admin_dashboard_stats(); $$);
-- Populate immediately so the first dashboard load isn't empty.
select refresh_admin_dashboard_stats();

-- ════════════════════════════════════════════════════════════════
-- PART 3 — RETENTION (pg_cron)
-- ════════════════════════════════════════════════════════════════
-- NOTE on partitioning: true declarative partitioning of orders /
-- wallet_transactions / audit_log requires recreating those tables as
-- partitioned parents (not an in-place ALTER) and rewriting their FKs
-- — a maintenance-window migration that must be planned against live
-- data. It is intentionally deferred. The retention jobs below cap the
-- highest-growth, lowest-value tables in the meantime.
--
-- audit_log is NOT auto-pruned here: it is the financial/compliance
-- record (payment mismatches, role changes, payouts). Archive it to
-- cold storage on a compliance schedule instead of deleting.

-- Read notifications older than 90 days are safe to drop.
create or replace function prune_old_notifications()
returns void language sql security definer set search_path = public as $$
  delete from notifications where is_read = true and created_at < now() - interval '90 days';
$$;
select cron.schedule('prune-notifications', '23 3 * * *', $$ select prune_old_notifications(); $$);

-- Processed Razorpay webhook events older than 180 days (idempotency
-- window long past). Unprocessed events are kept for investigation.
create or replace function prune_old_payment_events()
returns void language sql security definer set search_path = public as $$
  delete from payment_events where processed_at is not null and processed_at < now() - interval '180 days';
$$;
select cron.schedule('prune-payment-events', '37 3 * * *', $$ select prune_old_payment_events(); $$);

-- ════════════════════════════════════════════════════════════════
-- PART 4 — OBSERVABILITY (frontend error capture)
-- ════════════════════════════════════════════════════════════════
-- A place for the SPA to record uncaught errors / ErrorBoundary
-- catches, so production crashes are visible without a third-party
-- SaaS. Writes go ONLY through the rate-limited security-definer RPC
-- below (no direct client INSERT), so it can't be spammed into a DoS.

create table if not exists client_error_logs (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references auth.users(id) on delete set null,
  level      text not null default 'error' check (level in ('debug','info','warn','error','fatal')),
  message    text not null,
  context    jsonb,
  url        text,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_error_logs_created_at on client_error_logs (created_at desc);
create index if not exists idx_client_error_logs_level      on client_error_logs (level);

alter table client_error_logs enable row level security;

-- Admins/super_admins read; nobody writes directly (RPC only).
drop policy if exists "client_error_logs_admin_read" on client_error_logs;
create policy "client_error_logs_admin_read"
  on client_error_logs for select using (is_admin());

create or replace function log_client_error(
  p_level   text,
  p_message text,
  p_context jsonb default null,
  p_url     text  default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_message is null or length(trim(p_message)) = 0 then
    return;
  end if;
  -- Throttle: 30 reports / 5 min per user (or 'anon') — drop excess silently.
  if not check_rate_limit('client-error:' || coalesce(v_uid::text, 'anon'), 30, 300) then
    return;
  end if;

  insert into client_error_logs (user_id, level, message, context, url)
  values (
    v_uid,
    coalesce(nullif(p_level, ''), 'error'),
    left(p_message, 2000),
    p_context,
    left(coalesce(p_url, ''), 500)
  );
end;
$$;
grant execute on function log_client_error(text, text, jsonb, text) to anon, authenticated;

-- Retain client error logs for 30 days only.
create or replace function prune_client_error_logs()
returns void language sql security definer set search_path = public as $$
  delete from client_error_logs where created_at < now() - interval '30 days';
$$;
select cron.schedule('prune-client-errors', '47 3 * * *', $$ select prune_client_error_logs(); $$);

-- ── Audit ───────────────────────────────────────────────────────
insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'ops_migration', 'fees,stats,retention,observability',
  'migration_019: fee single-source via get_fee_config() (create_order/record_delivery_split/update_order_status now config-driven); cached admin_dashboard_stats MV + get_admin_stats/get_village_dashboard_stats RPCs; pg_cron retention for notifications/payment_events/client_error_logs; client_error_logs + log_client_error RPC for frontend observability'
);
