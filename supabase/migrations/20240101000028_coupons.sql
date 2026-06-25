-- ═══════════════════════════════════════════════════════════════
-- Migration 028: Coupons (Marketplace consolidation)
--
-- A real discount-coupon system, integrated into the server-
-- authoritative order pipeline (create_order). Discounts are computed
-- and applied SERVER-SIDE; redemptions are recorded atomically with the
-- order; usage/per-user limits are enforced in the same transaction.
--
-- Admin CRUD is gated by dynamic RBAC (coupons.create / coupons.manage)
-- and audited. The customer-facing path is validate_coupon() (preview)
-- + create_order(p_coupon_code) (apply). The whole feature is also
-- behind the 'coupons' feature flag on the client.
-- ═══════════════════════════════════════════════════════════════

create table if not exists coupons (
  id             uuid primary key default uuid_generate_v4(),
  code           text unique not null,
  description    text,
  discount_type  text not null check (discount_type in ('percent','flat')),
  discount_value numeric(10,2) not null check (discount_value > 0),
  max_discount   numeric(10,2),                 -- cap for percent coupons
  min_order      numeric(10,2) not null default 0,
  applies_to     text not null default 'all' check (applies_to in ('all','vendor')),
  vendor_id      uuid references vendors(id) on delete cascade,
  usage_limit    integer,                        -- total redemptions (null = unlimited)
  per_user_limit integer not null default 1,
  used_count     integer not null default 0,
  valid_from     timestamptz,
  valid_to       timestamptz,
  is_active      boolean not null default true,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_coupons_code      on coupons(upper(code));
create index if not exists idx_coupons_is_active  on coupons(is_active) where is_active = true;
create trigger trg_coupons_updated_at before update on coupons
  for each row execute function update_updated_at();

create table if not exists coupon_redemptions (
  id          uuid primary key default uuid_generate_v4(),
  coupon_id   uuid not null references coupons(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  order_id    uuid references orders(id) on delete set null,
  discount    numeric(10,2) not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_coupon_redemptions_coupon on coupon_redemptions(coupon_id);
create index if not exists idx_coupon_redemptions_user   on coupon_redemptions(user_id);

-- Trace the coupon on the order itself.
alter table orders
  add column if not exists coupon_code     text,
  add column if not exists coupon_discount numeric(10,2) not null default 0;

-- ── Evaluation (internal): is this coupon valid for this cart? ──
-- Returns { valid, discount, coupon_id, reason }. No permission check —
-- callers (validate_coupon / create_order) own the context.
create or replace function _evaluate_coupon(
  p_code text, p_subtotal numeric, p_vendor_id uuid, p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c        coupons%rowtype;
  v_disc   numeric(10,2);
  v_used   integer;
begin
  select * into c from coupons where upper(code) = upper(trim(p_code));
  if not found or not c.is_active then
    return jsonb_build_object('valid', false, 'reason', 'Invalid or inactive coupon');
  end if;
  if c.valid_from is not null and now() < c.valid_from then
    return jsonb_build_object('valid', false, 'reason', 'Coupon not yet active');
  end if;
  if c.valid_to is not null and now() > c.valid_to then
    return jsonb_build_object('valid', false, 'reason', 'Coupon has expired');
  end if;
  if p_subtotal < c.min_order then
    return jsonb_build_object('valid', false, 'reason', format('Minimum order ₹%s required', c.min_order));
  end if;
  if c.applies_to = 'vendor' and (p_vendor_id is null or p_vendor_id <> c.vendor_id) then
    return jsonb_build_object('valid', false, 'reason', 'Coupon not valid for this vendor');
  end if;
  if c.usage_limit is not null and c.used_count >= c.usage_limit then
    return jsonb_build_object('valid', false, 'reason', 'Coupon fully redeemed');
  end if;
  if p_user_id is not null then
    select count(*) into v_used from coupon_redemptions where coupon_id = c.id and user_id = p_user_id;
    if v_used >= c.per_user_limit then
      return jsonb_build_object('valid', false, 'reason', 'You have already used this coupon');
    end if;
  end if;

  if c.discount_type = 'percent' then
    v_disc := round(p_subtotal * c.discount_value / 100, 2);
    if c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
  else
    v_disc := c.discount_value;
  end if;
  v_disc := least(v_disc, p_subtotal);  -- never exceed cart value

  return jsonb_build_object('valid', true, 'discount', v_disc, 'coupon_id', c.id);
end;
$$;
revoke execute on function _evaluate_coupon(text, numeric, uuid, uuid) from authenticated, anon;

-- Customer-facing preview (uses the caller's identity for per-user limit).
create or replace function validate_coupon(p_code text, p_subtotal numeric, p_vendor_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select _evaluate_coupon(p_code, p_subtotal, p_vendor_id, auth.uid());
$$;
grant execute on function validate_coupon(text, numeric, uuid) to authenticated;

-- ── Admin CRUD (coupons.create / coupons.manage, audited) ───────
create or replace function upsert_coupon(
  p_id uuid, p_code text, p_description text,
  p_discount_type text, p_discount_value numeric, p_max_discount numeric,
  p_min_order numeric, p_applies_to text, p_vendor_id uuid,
  p_usage_limit integer, p_per_user_limit integer,
  p_valid_from timestamptz, p_valid_to timestamptz, p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not has_permission('coupons.create') then
    raise exception 'Unauthorized: coupons.create required';
  end if;
  if p_code !~ '^[A-Za-z0-9_-]{3,32}$' then
    raise exception 'Coupon code must be 3–32 alphanumeric characters';
  end if;
  if p_discount_type not in ('percent','flat') then raise exception 'Invalid discount type'; end if;
  if p_applies_to = 'vendor' and p_vendor_id is null then raise exception 'vendor_id required for vendor coupon'; end if;

  if p_id is null then
    insert into coupons (code, description, discount_type, discount_value, max_discount, min_order,
                         applies_to, vendor_id, usage_limit, per_user_limit, valid_from, valid_to, is_active, created_by)
    values (upper(trim(p_code)), p_description, p_discount_type, p_discount_value, p_max_discount, coalesce(p_min_order,0),
            coalesce(p_applies_to,'all'), p_vendor_id, p_usage_limit, coalesce(p_per_user_limit,1),
            p_valid_from, p_valid_to, coalesce(p_is_active,true), auth.uid())
    returning id into v_id;
  else
    update coupons set
      code=upper(trim(p_code)), description=p_description, discount_type=p_discount_type,
      discount_value=p_discount_value, max_discount=p_max_discount, min_order=coalesce(p_min_order,0),
      applies_to=coalesce(p_applies_to,'all'), vendor_id=p_vendor_id, usage_limit=p_usage_limit,
      per_user_limit=coalesce(p_per_user_limit,1), valid_from=p_valid_from, valid_to=p_valid_to,
      is_active=coalesce(p_is_active,true), updated_at=now()
    where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Coupon not found'; end if;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          case when p_id is null then 'coupon_created' else 'coupon_updated' end, v_id::text, upper(trim(p_code)));
  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;
grant execute on function upsert_coupon(uuid, text, text, text, numeric, numeric, numeric, text, uuid, integer, integer, timestamptz, timestamptz, boolean) to authenticated;

create or replace function set_coupon_active(p_id uuid, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_permission('coupons.manage') then
    raise exception 'Unauthorized: coupons.manage required';
  end if;
  update coupons set is_active = p_active, updated_at = now() where id = p_id;
  if not found then raise exception 'Coupon not found'; end if;
  insert into audit_log (actor_id, actor, action, target, detail)
  values (auth.uid(), coalesce((select name from profiles where id = auth.uid()), 'admin'),
          case when p_active then 'coupon_activated' else 'coupon_deactivated' end, p_id::text, '');
  return jsonb_build_object('success', true);
end;
$$;
grant execute on function set_coupon_active(uuid, boolean) to authenticated;

-- ── RLS: catalog read for coupons.view; writes via RPC only ─────
alter table coupons             enable row level security;
alter table coupon_redemptions  enable row level security;
drop policy if exists "coupons_admin_read" on coupons;
create policy "coupons_admin_read" on coupons for select using (has_permission('coupons.view'));
drop policy if exists "coupon_redemptions_read" on coupon_redemptions;
create policy "coupon_redemptions_read" on coupon_redemptions for select
  using (has_permission('coupons.view') or user_id = auth.uid());

insert into audit_log (actor_id, actor, action, target, detail)
values (null, 'system', 'ops_migration', 'coupons',
  'migration_028: coupons — validate_coupon/_evaluate_coupon, audited upsert_coupon/set_coupon_active (coupons.create/manage), coupon_redemptions, orders.coupon_code/coupon_discount; create_order coupon integration in same migration');

-- ── create_order: identical to migration 023/019 + coupon support ──
-- Drop the previous 7-arg overload first so the new 8-arg version is the
-- only create_order — otherwise named-arg calls become ambiguous.
drop function if exists create_order(uuid, jsonb, text, text, text, text, boolean);

create or replace function create_order(
  p_vendor_id       uuid,
  p_items           jsonb,
  p_payment_method  text    default 'COD',
  p_delivery_address text   default null,
  p_village_id      text    default null,
  p_delivery_notes  text    default null,
  p_use_credit      boolean default false,
  p_coupon_code     text    default null
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

  -- ── Record coupon redemption atomically with the order ──
  if v_coupon_id is not null then
    insert into coupon_redemptions (coupon_id, user_id, order_id, discount)
    values (v_coupon_id, v_uid, v_order_id, v_coupon_discount);
    update coupons set used_count = used_count + 1, updated_at = now() where id = v_coupon_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (v_uid, coalesce(v_customer_name, 'customer'), 'order_created', v_order_number,
    format('subtotal=₹%s credit=₹%s coupon=₹%s delivery=₹%s platform=₹%s total=₹%s method=%s',
           v_subtotal, v_credit_discount, v_coupon_discount, v_delivery_fee, v_platform_fee, v_total, p_payment_method));

  return jsonb_build_object(
    'success', true, 'id', v_order_id, 'order_number', v_order_number,
    'status', 'pending', 'payment_status', 'pending', 'payment_method', p_payment_method,
    'vendor_id', v_vendor.id, 'vendor_name', v_vendor.name,
    'subtotal', v_subtotal, 'credit_discount', v_credit_discount, 'coupon_discount', v_coupon_discount,
    'delivery_fee', v_delivery_fee, 'platform_fee', v_platform_fee, 'total', v_total
  );
end;
$$;

grant execute on function create_order(uuid, jsonb, text, text, text, text, boolean, text) to authenticated;
