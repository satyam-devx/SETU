-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — ROW LEVEL SECURITY POLICIES
-- Run after schema.sql
-- ═══════════════════════════════════════════════════════════

-- ── HELPER: get current user's role ──────────────────────
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer stable;

-- ── HELPER: get current user's village_id ────────────────
create or replace function get_my_village_id()
returns text as $$
  select village_id from profiles where id = auth.uid()
$$ language sql security definer stable;

-- ── HELPER: is current user super_admin or admin ─────────
create or replace function is_admin()
returns boolean as $$
  select get_my_role() in ('admin','super_admin')
$$ language sql security definer stable;

-- ════════════════════════════════════════════════════════
-- VILLAGES
-- ════════════════════════════════════════════════════════
alter table villages enable row level security;

create policy "villages_public_read"
  on villages for select using (true);

create policy "villages_admin_write"
  on villages for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════
alter table profiles enable row level security;

-- Own profile: full access
create policy "profiles_own_read"
  on profiles for select using (auth.uid() = id);

create policy "profiles_own_insert"
  on profiles for insert with check (auth.uid() = id);

create policy "profiles_own_update"
  on profiles for update using (auth.uid() = id);

-- Admins can read all profiles in their village
create policy "profiles_admin_read"
  on profiles for select using (
    is_admin() and (
      get_my_role() = 'super_admin' or
      village_id = get_my_village_id()
    )
  );

-- ════════════════════════════════════════════════════════
-- CATEGORIES
-- ════════════════════════════════════════════════════════
alter table categories enable row level security;

create policy "categories_public_read"
  on categories for select using (is_active = true);

create policy "categories_admin_write"
  on categories for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDORS
-- ════════════════════════════════════════════════════════
alter table vendors enable row level security;

-- Public: read active, verified vendors
create policy "vendors_public_read"
  on vendors for select using (is_active = true);

-- Vendor: full access to own record
create policy "vendors_own_write"
  on vendors for all using (owner_id = auth.uid());

-- Anchor: read vendors in their village
create policy "vendors_anchor_read"
  on vendors for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

-- Admin: full access
create policy "vendors_admin_all"
  on vendors for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDOR HOURS
-- ════════════════════════════════════════════════════════
alter table vendor_hours enable row level security;

create policy "vendor_hours_public_read"
  on vendor_hours for select using (true);

create policy "vendor_hours_own_write"
  on vendor_hours for all using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_hours_admin_all"
  on vendor_hours for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- PRODUCTS
-- ════════════════════════════════════════════════════════
alter table products enable row level security;

-- Public: read available products
create policy "products_public_read"
  on products for select using (is_available = true);

-- Vendor: full access to own products
create policy "products_own_write"
  on products for all using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

-- Admin: full access
create policy "products_admin_all"
  on products for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- ORDERS
-- ════════════════════════════════════════════════════════
alter table orders enable row level security;

-- Customer: read/create own orders
create policy "orders_customer_read"
  on orders for select using (customer_id = auth.uid());

create policy "orders_customer_insert"
  on orders for insert with check (customer_id = auth.uid());

-- Customer: can cancel own pending/confirmed orders
create policy "orders_customer_cancel"
  on orders for update using (
    customer_id = auth.uid() and
    status in ('pending','confirmed')
  );

-- Vendor: read/update orders for their store
create policy "orders_vendor_read"
  on orders for select using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "orders_vendor_update"
  on orders for update using (
    vendor_id in (select id from vendors where owner_id = auth.uid()) and
    status in ('pending','confirmed','preparing','ready')
  );

-- Rider: read unassigned orders + own assigned orders
create policy "orders_rider_read_unassigned"
  on orders for select using (
    get_my_role() = 'rider' and rider_id is null and status = 'pending'
  );

create policy "orders_rider_read_assigned"
  on orders for select using (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "orders_rider_update"
  on orders for update using (
    rider_id in (select id from riders where user_id = auth.uid())
  );

-- Anchor: read orders in their village
create policy "orders_anchor_read"
  on orders for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

-- Admin: full access
create policy "orders_admin_all"
  on orders for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- ORDER ITEMS
-- ════════════════════════════════════════════════════════
alter table order_items enable row level security;

-- Readable if the parent order is readable (via order_id)
create policy "order_items_customer_read"
  on order_items for select using (
    order_id in (select id from orders where customer_id = auth.uid())
  );

create policy "order_items_vendor_read"
  on order_items for select using (
    order_id in (
      select o.id from orders o
      join vendors v on v.id = o.vendor_id
      where v.owner_id = auth.uid()
    )
  );

create policy "order_items_rider_read"
  on order_items for select using (
    order_id in (
      select o.id from orders o
      join riders r on r.id = o.rider_id
      where r.user_id = auth.uid()
    )
  );

create policy "order_items_insert_own"
  on order_items for insert with check (
    order_id in (select id from orders where customer_id = auth.uid())
  );

create policy "order_items_admin_all"
  on order_items for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- RIDERS
-- ════════════════════════════════════════════════════════
alter table riders enable row level security;

-- Public: read basic rider info (for order tracking)
create policy "riders_public_read"
  on riders for select using (is_active = true);

-- Rider: full access to own record
create policy "riders_own_write"
  on riders for all using (user_id = auth.uid());

-- Admin: full access
create policy "riders_admin_all"
  on riders for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- RIDER LOCATIONS
-- ════════════════════════════════════════════════════════
alter table rider_locations enable row level security;

-- Rider: insert own location
create policy "rider_locations_own_insert"
  on rider_locations for insert with check (
    rider_id in (select id from riders where user_id = auth.uid())
  );

-- Customer with active order can read assigned rider location
create policy "rider_locations_customer_read"
  on rider_locations for select using (
    rider_id in (
      select r.id from riders r
      join orders o on o.rider_id = r.id
      where o.customer_id = auth.uid()
        and o.status in ('picked_up','on_the_way')
    )
  );

-- Admin: full access
create policy "rider_locations_admin_all"
  on rider_locations for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- SEVA PROVIDERS
-- ════════════════════════════════════════════════════════
alter table seva_providers enable row level security;

create policy "seva_providers_public_read"
  on seva_providers for select using (is_active = true or is_active is null);

create policy "seva_providers_own_write"
  on seva_providers for all using (user_id = auth.uid());

create policy "seva_providers_admin_all"
  on seva_providers for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- SEVA JOBS
-- ════════════════════════════════════════════════════════
alter table seva_jobs enable row level security;

create policy "seva_jobs_customer_read"
  on seva_jobs for select using (customer_id = auth.uid());

create policy "seva_jobs_customer_insert"
  on seva_jobs for insert with check (customer_id = auth.uid());

create policy "seva_jobs_provider_read"
  on seva_jobs for select using (
    provider_id in (select id from seva_providers where user_id = auth.uid())
    or (status = 'open' and get_my_role() = 'seva_provider')
  );

create policy "seva_jobs_provider_update"
  on seva_jobs for update using (
    provider_id in (select id from seva_providers where user_id = auth.uid())
  );

create policy "seva_jobs_admin_all"
  on seva_jobs for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- WALLETS
-- ════════════════════════════════════════════════════════
alter table wallets enable row level security;

create policy "wallets_own"
  on wallets for all using (user_id = auth.uid());

create policy "wallets_admin_read"
  on wallets for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- WALLET TRANSACTIONS
-- ════════════════════════════════════════════════════════
alter table wallet_transactions enable row level security;

create policy "wallet_txns_own"
  on wallet_transactions for all using (user_id = auth.uid());

create policy "wallet_txns_admin_read"
  on wallet_transactions for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT ACCOUNTS
-- ════════════════════════════════════════════════════════
alter table credit_accounts enable row level security;

create policy "credit_accounts_own"
  on credit_accounts for all using (user_id = auth.uid());

create policy "credit_accounts_admin_read"
  on credit_accounts for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT TRANSACTIONS
-- ════════════════════════════════════════════════════════
alter table credit_transactions enable row level security;

create policy "credit_txns_own"
  on credit_transactions for all using (user_id = auth.uid());

create policy "credit_txns_admin_read"
  on credit_transactions for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════════════════
alter table notifications enable row level security;

create policy "notifications_own"
  on notifications for all using (user_id = auth.uid());

create policy "notifications_admin_insert"
  on notifications for insert with check (is_admin());

-- ════════════════════════════════════════════════════════
-- SUPPORT TICKETS
-- ════════════════════════════════════════════════════════
alter table support_tickets enable row level security;

create policy "support_tickets_own_read"
  on support_tickets for select using (user_id = auth.uid());

create policy "support_tickets_own_insert"
  on support_tickets for insert with check (user_id = auth.uid());

create policy "support_tickets_admin_all"
  on support_tickets for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- AUDIT LOG
-- ════════════════════════════════════════════════════════
alter table audit_log enable row level security;

create policy "audit_log_admin_read"
  on audit_log for select using (is_admin());

create policy "audit_log_system_insert"
  on audit_log for insert with check (true); -- system inserts via service role

-- ════════════════════════════════════════════════════════
-- SCHEMES
-- ════════════════════════════════════════════════════════
alter table schemes enable row level security;

create policy "schemes_public_read"
  on schemes for select using (is_active = true);

create policy "schemes_admin_write"
  on schemes for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- COD DEPOSITS
-- ════════════════════════════════════════════════════════
alter table cod_deposits enable row level security;

create policy "cod_deposits_rider_own"
  on cod_deposits for all using (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "cod_deposits_admin_all"
  on cod_deposits for all using (is_admin());

-- ════════════════════════════════════════════════════════
-- KYC RECORDS
-- ════════════════════════════════════════════════════════
alter table kyc_records enable row level security;

create policy "kyc_records_own"
  on kyc_records for all using (user_id = auth.uid());

create policy "kyc_records_anchor_read"
  on kyc_records for select using (
    get_my_role() in ('anchor','admin','super_admin')
  );

-- ════════════════════════════════════════════════════════
-- Enable Realtime on key tables
-- ════════════════════════════════════════════════════════
-- Run these in Supabase Dashboard → Database → Replication
-- or via SQL:
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table rider_locations;
alter publication supabase_realtime add table order_items;
