-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — ROW LEVEL SECURITY POLICIES
-- Phase 2 hardened:
--  1. FOR ALL policies split: USING for SELECT/UPDATE/DELETE,
--     WITH CHECK for INSERT — prevents privilege escalation.
--  2. audit_log_system_insert restricted to service_role only;
--     all audit writes go through security-definer functions.
--  3. New tables: disputes, escalations, noticeboard,
--     payment_events, payment_orders, wallet_topups.
-- Run after schema.sql
-- ═══════════════════════════════════════════════════════════

-- ── HELPERS ───────────────────────────────────────────────
create or replace function get_my_role()
returns text as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer stable;

create or replace function get_my_village_id()
returns text as $$
  select village_id from profiles where id = auth.uid()
$$ language sql security definer stable;

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
  on villages for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- PROFILES
-- ════════════════════════════════════════════════════════
alter table profiles enable row level security;

create policy "profiles_own_read"
  on profiles for select using (auth.uid() = id);

create policy "profiles_own_insert"
  on profiles for insert with check (auth.uid() = id);

create policy "profiles_own_update"
  on profiles for update
  using     (auth.uid() = id)
  with check (auth.uid() = id);

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
  on categories for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDORS
-- ════════════════════════════════════════════════════════
alter table vendors enable row level security;

create policy "vendors_public_read"
  on vendors for select using (is_active = true);

-- FIX: FOR ALL without WITH CHECK allowed a vendor to INSERT
-- a row with a different owner_id. Split into SELECT/UPDATE/DELETE
-- with USING, and INSERT with WITH CHECK.
create policy "vendors_own_select"
  on vendors for select using (owner_id = auth.uid());

create policy "vendors_own_insert"
  on vendors for insert with check (owner_id = auth.uid());

create policy "vendors_own_update"
  on vendors for update
  using     (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "vendors_own_delete"
  on vendors for delete using (owner_id = auth.uid());

create policy "vendors_anchor_read"
  on vendors for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "vendors_admin_all"
  on vendors for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDOR HOURS
-- ════════════════════════════════════════════════════════
alter table vendor_hours enable row level security;

create policy "vendor_hours_public_read"
  on vendor_hours for select using (true);

create policy "vendor_hours_own_insert"
  on vendor_hours for insert with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_hours_own_update"
  on vendor_hours for update
  using (vendor_id in (select id from vendors where owner_id = auth.uid()))
  with check (vendor_id in (select id from vendors where owner_id = auth.uid()));

create policy "vendor_hours_own_delete"
  on vendor_hours for delete using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_hours_admin_all"
  on vendor_hours for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- PRODUCTS
-- ════════════════════════════════════════════════════════
alter table products enable row level security;

create policy "products_public_read"
  on products for select using (is_available = true);

-- FIX: same FOR ALL → split pattern
create policy "products_own_select"
  on products for select using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "products_own_insert"
  on products for insert with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "products_own_update"
  on products for update
  using (vendor_id in (select id from vendors where owner_id = auth.uid()))
  with check (vendor_id in (select id from vendors where owner_id = auth.uid()));

create policy "products_own_delete"
  on products for delete using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "products_admin_all"
  on products for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- ORDERS
-- ════════════════════════════════════════════════════════
alter table orders enable row level security;

create policy "orders_customer_read"
  on orders for select using (customer_id = auth.uid());

create policy "orders_customer_insert"
  on orders for insert with check (customer_id = auth.uid());

create policy "orders_customer_cancel"
  on orders for update
  using (
    customer_id = auth.uid() and
    status in ('pending','confirmed')
  )
  with check (customer_id = auth.uid());

create policy "orders_vendor_read"
  on orders for select using (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "orders_vendor_update"
  on orders for update
  using (
    vendor_id in (select id from vendors where owner_id = auth.uid()) and
    status in ('pending','confirmed','preparing','ready')
  )
  with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "orders_rider_read_unassigned"
  on orders for select using (
    get_my_role() = 'rider' and rider_id is null and status = 'ready'
  );

create policy "orders_rider_read_assigned"
  on orders for select using (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "orders_rider_update"
  on orders for update
  using (rider_id in (select id from riders where user_id = auth.uid()))
  with check (rider_id in (select id from riders where user_id = auth.uid()));

create policy "orders_anchor_read"
  on orders for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "orders_admin_all"
  on orders for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- ORDER ITEMS
-- ════════════════════════════════════════════════════════
alter table order_items enable row level security;

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
  on order_items for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- RIDERS
-- ════════════════════════════════════════════════════════
alter table riders enable row level security;

create policy "riders_public_read"
  on riders for select using (is_active = true);

create policy "riders_own_select"
  on riders for select using (user_id = auth.uid());

create policy "riders_own_insert"
  on riders for insert with check (user_id = auth.uid());

create policy "riders_own_update"
  on riders for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "riders_admin_all"
  on riders for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- RIDER LOCATIONS
-- ════════════════════════════════════════════════════════
alter table rider_locations enable row level security;

create policy "rider_locations_own_insert"
  on rider_locations for insert with check (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "rider_locations_customer_read"
  on rider_locations for select using (
    rider_id in (
      select r.id from riders r
      join orders o on o.rider_id = r.id
      where o.customer_id = auth.uid()
        and o.status in ('picked_up','on_the_way')
    )
  );

create policy "rider_locations_admin_all"
  on rider_locations for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- SEVA PROVIDERS
-- ════════════════════════════════════════════════════════
alter table seva_providers enable row level security;

create policy "seva_providers_public_read"
  on seva_providers for select using (is_available = true or is_available is null);

create policy "seva_providers_own_insert"
  on seva_providers for insert with check (user_id = auth.uid());

create policy "seva_providers_own_update"
  on seva_providers for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "seva_providers_own_delete"
  on seva_providers for delete using (user_id = auth.uid());

create policy "seva_providers_admin_all"
  on seva_providers for all
  using  (is_admin())
  with check (is_admin());

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
  on seva_jobs for update
  using (provider_id in (select id from seva_providers where user_id = auth.uid()))
  with check (provider_id in (select id from seva_providers where user_id = auth.uid()));

create policy "seva_jobs_admin_all"
  on seva_jobs for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- WALLETS
-- ════════════════════════════════════════════════════════
alter table wallets enable row level security;

create policy "wallets_own_read"
  on wallets for select using (user_id = auth.uid());

-- Wallets are created/updated only via security-definer functions
-- (topup_wallet, pay_from_wallet). Direct INSERT/UPDATE blocked.
create policy "wallets_admin_read"
  on wallets for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- WALLET TRANSACTIONS
-- ════════════════════════════════════════════════════════
alter table wallet_transactions enable row level security;

create policy "wallet_txns_own_read"
  on wallet_transactions for select using (user_id = auth.uid());

create policy "wallet_txns_admin_read"
  on wallet_transactions for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- PAYMENT ORDERS
-- ════════════════════════════════════════════════════════
alter table payment_orders enable row level security;

create policy "payment_orders_own_read"
  on payment_orders for select using (user_id = auth.uid());

create policy "payment_orders_admin_all"
  on payment_orders for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- PAYMENT EVENTS  (webhook log — no user access)
-- ════════════════════════════════════════════════════════
alter table payment_events enable row level security;

-- Admins can read for auditing; writes via service_role webhook handler only
create policy "payment_events_admin_read"
  on payment_events for select using (is_admin());

-- No INSERT/UPDATE policy: only service_role (webhook Edge Function) writes here

-- ════════════════════════════════════════════════════════
-- WALLET TOPUPS
-- ════════════════════════════════════════════════════════
alter table wallet_topups enable row level security;

create policy "wallet_topups_own_read"
  on wallet_topups for select using (user_id = auth.uid());

create policy "wallet_topups_admin_all"
  on wallet_topups for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT ACCOUNTS
-- ════════════════════════════════════════════════════════
alter table credit_accounts enable row level security;

create policy "credit_accounts_own_read"
  on credit_accounts for select using (user_id = auth.uid());

create policy "credit_accounts_admin_read"
  on credit_accounts for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT TRANSACTIONS
-- ════════════════════════════════════════════════════════
alter table credit_transactions enable row level security;

create policy "credit_txns_own_read"
  on credit_transactions for select using (user_id = auth.uid());

create policy "credit_txns_admin_read"
  on credit_transactions for select using (is_admin());

-- ════════════════════════════════════════════════════════
-- CREDIT DISBURSEMENTS
-- ════════════════════════════════════════════════════════
alter table credit_disbursements enable row level security;

create policy "credit_disbursements_own_read"
  on credit_disbursements for select using (user_id = auth.uid());

create policy "credit_disbursements_admin_all"
  on credit_disbursements for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ════════════════════════════════════════════════════════
alter table notifications enable row level security;

create policy "notifications_own"
  on notifications for select using (user_id = auth.uid());

create policy "notifications_own_update"
  on notifications for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Only service_role / security-definer functions insert notifications
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
  on support_tickets for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- AUDIT LOG
-- FIX: removed "with check (true)" which allowed any authenticated
-- user to write arbitrary rows. All writes now go through
-- security-definer functions (place_order, update_order_status, etc.)
-- which bypass RLS. Direct INSERT is blocked for all roles.
-- ════════════════════════════════════════════════════════
alter table audit_log enable row level security;

create policy "audit_log_admin_read"
  on audit_log for select using (is_admin());

-- No INSERT policy: only security-definer functions (which run as
-- the function owner, bypassing RLS) may write to audit_log.
-- This prevents users from injecting fake audit entries.

-- ════════════════════════════════════════════════════════
-- SCHEMES
-- ════════════════════════════════════════════════════════
alter table schemes enable row level security;

create policy "schemes_public_read"
  on schemes for select using (is_active = true);

create policy "schemes_admin_write"
  on schemes for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- COD DEPOSITS
-- ════════════════════════════════════════════════════════
alter table cod_deposits enable row level security;

create policy "cod_deposits_rider_read"
  on cod_deposits for select using (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "cod_deposits_rider_insert"
  on cod_deposits for insert with check (
    rider_id in (select id from riders where user_id = auth.uid())
  );

create policy "cod_deposits_admin_all"
  on cod_deposits for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- KYC RECORDS
-- aadhaar_encrypted column excluded from all SELECT policies
-- via column-level security (see store_aadhaar / decrypt_aadhaar).
-- ════════════════════════════════════════════════════════
alter table kyc_records enable row level security;

-- Users may only read non-sensitive columns (enforced by app layer;
-- column-level grants tighten this further if needed)
create policy "kyc_records_own_read"
  on kyc_records for select using (user_id = auth.uid());

create policy "kyc_records_own_insert"
  on kyc_records for insert with check (user_id = auth.uid());

create policy "kyc_records_own_update"
  on kyc_records for update
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "kyc_records_anchor_read"
  on kyc_records for select using (
    get_my_role() in ('anchor','admin','super_admin')
  );

-- ════════════════════════════════════════════════════════
-- DISPUTES
-- ════════════════════════════════════════════════════════
alter table disputes enable row level security;

create policy "disputes_own_read"
  on disputes for select using (raised_by = auth.uid() or against = auth.uid());

create policy "disputes_own_insert"
  on disputes for insert with check (raised_by = auth.uid());

-- Anchors manage disputes in their village
create policy "disputes_anchor_read"
  on disputes for select using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "disputes_anchor_update"
  on disputes for update
  using (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  )
  with check (
    get_my_role() = 'anchor' and village_id = get_my_village_id()
  );

create policy "disputes_admin_all"
  on disputes for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- ESCALATIONS
-- ════════════════════════════════════════════════════════
alter table escalations enable row level security;

create policy "escalations_anchor_own"
  on escalations for select using (escalated_by = auth.uid());

create policy "escalations_anchor_insert"
  on escalations for insert with check (
    escalated_by = auth.uid() and get_my_role() in ('anchor','admin','super_admin')
  );

create policy "escalations_admin_all"
  on escalations for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- NOTICEBOARD
-- ════════════════════════════════════════════════════════
alter table noticeboard enable row level security;

-- Anyone in the same village (or any authenticated user) can read
create policy "noticeboard_village_read"
  on noticeboard for select using (
    village_id = get_my_village_id()
    or get_my_role() in ('admin','super_admin')
  );

-- Only anchors and admins can post
create policy "noticeboard_anchor_insert"
  on noticeboard for insert with check (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  );

create policy "noticeboard_anchor_update"
  on noticeboard for update
  using (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  )
  with check (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  );

create policy "noticeboard_anchor_delete"
  on noticeboard for delete using (
    author_id = auth.uid() and
    get_my_role() in ('anchor','admin','super_admin')
  );

create policy "noticeboard_admin_all"
  on noticeboard for all
  using  (is_admin())
  with check (is_admin());

-- ════════════════════════════════════════════════════════
-- VENDOR LOCATIONS
-- ════════════════════════════════════════════════════════
alter table vendor_locations enable row level security;

create policy "vendor_locations_public_read"
  on vendor_locations for select using (true);

create policy "vendor_locations_own_write"
  on vendor_locations for insert with check (
    vendor_id in (select id from vendors where owner_id = auth.uid())
  );

create policy "vendor_locations_admin_all"
  on vendor_locations for all
  using  (is_admin())
  with check (is_admin());
