-- ═══════════════════════════════════════════════════════════
-- SETU PLATFORM — DATABASE FUNCTIONS & RPCs
-- Phase 2 hardened:
--  1. place_order   — uses nextval('order_number_seq'), not COUNT+1
--  2. pay_from_wallet — single atomic UPDATE ... RETURNING
--  3. store_aadhaar / decrypt_aadhaar — pgcrypto Aadhaar helpers
--  4. handle_new_user trigger — auto-profile on auth.users INSERT
--  5. pg_cron job — prune rider_locations older than 48 h
-- ═══════════════════════════════════════════════════════════

-- ── place_order ───────────────────────────────────────────
-- Atomically creates an order + order_items in one transaction.
-- Uses nextval() for a collision-free order number.
create or replace function place_order(
  p_customer_id      uuid,
  p_customer_name    text,
  p_vendor_id        uuid,
  p_vendor_name      text,
  p_village_id       text,
  p_village          text,
  p_payment_method   text,
  p_subtotal         numeric,
  p_delivery_fee     numeric,
  p_platform_fee     numeric,
  p_total            numeric,
  p_items            jsonb,          -- [{name, qty, price, product_id?}]
  p_delivery_address text    default null,
  p_use_credit       boolean default false
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order_id     uuid;
  v_order_number text;
  v_item         jsonb;
  v_result       jsonb;
begin
  v_order_id     := gen_random_uuid();
  -- nextval() is transactionally safe; COUNT+1 races under concurrency
  v_order_number := 'SETU-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('order_number_seq')::text, 4, '0');

  insert into orders (
    id, order_number, customer_id, customer_name,
    vendor_id, vendor_name, village_id, village,
    status, payment_method, payment_status,
    subtotal, delivery_fee, platform_fee, total,
    is_cod, delivery_address
  ) values (
    v_order_id, v_order_number, p_customer_id, p_customer_name,
    p_vendor_id, p_vendor_name, p_village_id, p_village,
    'pending', p_payment_method,
    case when p_payment_method = 'COD' then 'pending' else 'paid' end,
    p_subtotal, p_delivery_fee, p_platform_fee, p_total,
    p_payment_method = 'COD', p_delivery_address
  );

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into order_items (order_id, product_id, name, qty, price)
    values (
      v_order_id,
      case when (v_item->>'product_id') is not null
           then (v_item->>'product_id')::uuid
           else null end,
      v_item->>'name',
      (v_item->>'qty')::integer,
      (v_item->>'price')::numeric
    );

    if (v_item->>'product_id') is not null then
      update products
      set stock = greatest(0, stock - (v_item->>'qty')::integer)
      where id = (v_item->>'product_id')::uuid;
    end if;
  end loop;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (p_customer_id, p_customer_name, 'order_placed', v_order_number,
          'Total: ₹' || p_total);

  select to_jsonb(o.*) into v_result
  from orders o where o.id = v_order_id;

  return v_result;
end;
$$;

-- ── update_order_status ───────────────────────────────────
create or replace function update_order_status(
  p_order_id   uuid,
  p_new_status text,
  p_actor_id   uuid  default null,
  p_meta       jsonb default '{}'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_order   orders%rowtype;
  v_allowed text[];
begin
  select * into v_order from orders where id = p_order_id;
  if not found then
    return jsonb_build_object('error', 'Order not found');
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
    return jsonb_build_object(
      'error', 'Invalid transition: ' || v_order.status || ' → ' || p_new_status
    );
  end if;

  update orders set
    status        = p_new_status,
    updated_at    = now(),
    confirmed_at  = case when p_new_status = 'confirmed'  then now() else confirmed_at  end,
    ready_at      = case when p_new_status = 'ready'      then now() else ready_at      end,
    picked_up_at  = case when p_new_status = 'picked_up'  then now() else picked_up_at  end,
    delivered_at  = case when p_new_status = 'delivered'  then now() else delivered_at  end,
    cancelled_at  = case when p_new_status = 'cancelled'  then now() else cancelled_at  end,
    cancel_reason = coalesce(p_meta->>'cancel_reason', cancel_reason),
    rider_id      = coalesce((p_meta->>'rider_id')::uuid, rider_id),
    rider_name    = coalesce(p_meta->>'rider_name', rider_name)
  where id = p_order_id;

  if p_new_status = 'delivered' and v_order.rider_id is not null then
    update riders set
      today_deliveries = today_deliveries + 1,
      total_deliveries = total_deliveries + 1,
      today_earnings   = today_earnings + 80,
      total_earnings   = total_earnings + 80,
      cod_balance      = case when v_order.is_cod
                              then cod_balance + v_order.total
                              else cod_balance end
    where id = v_order.rider_id;
  end if;

  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    p_actor_id,
    coalesce((select name from profiles where id = p_actor_id), 'System'),
    'order_' || p_new_status,
    v_order.order_number,
    'Status: ' || v_order.status || ' → ' || p_new_status
  );

  return jsonb_build_object('success', true, 'order_id', p_order_id, 'status', p_new_status);
end;
$$;

-- ── rate_order ────────────────────────────────────────────
create or replace function rate_order(
  p_order_id      uuid,
  p_vendor_rating integer,
  p_rider_rating  integer default null,
  p_comment       text    default null
)
returns jsonb
language plpgsql
security definer
as $$
begin
  update orders set
    vendor_rating  = p_vendor_rating,
    rider_rating   = p_rider_rating,
    rating_comment = p_comment,
    is_rated       = true,
    updated_at     = now()
  where id = p_order_id and customer_id = auth.uid();

  if not found then
    return jsonb_build_object('error', 'Order not found or unauthorized');
  end if;

  update vendors v set
    rating       = (v.rating * v.review_count + p_vendor_rating) / (v.review_count + 1),
    review_count = v.review_count + 1
  from orders o
  where o.id = p_order_id and o.vendor_id = v.id;

  return jsonb_build_object('success', true);
end;
$$;

-- ── topup_wallet ──────────────────────────────────────────
create or replace function topup_wallet(
  p_user_id   uuid,
  p_amount    numeric,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_wallet_id  uuid;
  v_new_balance numeric;
begin
  insert into wallets (user_id, balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
    set balance    = wallets.balance + excluded.balance,
        updated_at = now()
  returning id, balance into v_wallet_id, v_new_balance;

  insert into wallet_transactions (wallet_id, user_id, type, amount, description, reference, status)
  values (v_wallet_id, p_user_id, 'credit', p_amount, 'Wallet top-up', p_reference, 'completed');

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- ── pay_from_wallet ───────────────────────────────────────
-- FIX: replaced read-then-write TOCTOU pattern with a single
-- atomic UPDATE ... WHERE balance >= amount RETURNING balance.
-- If the row isn't updated (balance too low or wallet missing),
-- we return insufficient_funds without touching the DB.
-- Called via supabase.rpc('pay_from_wallet', {...}).
create or replace function pay_from_wallet(
  p_user_id  uuid,
  p_amount   numeric,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_wallet_id   uuid;
  v_new_balance numeric;
begin
  -- One atomic statement: deduct only if balance is sufficient.
  -- The WHERE balance >= p_amount guard eliminates the TOCTOU window
  -- that existed in the old SELECT ... then UPDATE pattern.
  update wallets
  set    balance    = balance - p_amount,
         updated_at = now()
  where  user_id = p_user_id
    and  balance  >= p_amount
  returning id, balance into v_wallet_id, v_new_balance;

  -- If no row was updated: wallet missing or balance insufficient
  if not found then
    -- Distinguish the two failure modes for a better client error
    if exists (select 1 from wallets where user_id = p_user_id) then
      return jsonb_build_object(
        'success',           false,
        'insufficient_funds', true,
        'balance',            (select balance from wallets where user_id = p_user_id)
      );
    else
      return jsonb_build_object('success', false, 'error', 'Wallet not found');
    end if;
  end if;

  insert into wallet_transactions (
    wallet_id, user_id, type, amount, description, reference, status
  ) values (
    v_wallet_id,
    p_user_id,
    'debit',
    p_amount,
    'Order payment from wallet',
    p_order_id::text,
    'completed'
  );

  return jsonb_build_object('success', true, 'new_balance', v_new_balance);
end;
$$;

-- ── get_vendor_orders ─────────────────────────────────────
create or replace function get_vendor_orders(p_vendor_id uuid)
returns table (
  id             uuid,
  order_number   text,
  customer_name  text,
  village        text,
  status         text,
  payment_method text,
  payment_status text,
  total          numeric,
  is_cod         boolean,
  rider_name     text,
  created_at     timestamptz,
  items          jsonb
)
language sql
security definer
stable
as $$
  select
    o.id, o.order_number, o.customer_name, o.village,
    o.status, o.payment_method, o.payment_status,
    o.total, o.is_cod, o.rider_name, o.created_at,
    coalesce(
      jsonb_agg(jsonb_build_object(
        'name', oi.name, 'qty', oi.qty, 'price', oi.price
      )) filter (where oi.id is not null),
      '[]'
    ) as items
  from orders o
  left join order_items oi on oi.order_id = o.id
  where o.vendor_id = p_vendor_id
  group by o.id
  order by o.created_at desc;
$$;

-- ── store_aadhaar ─────────────────────────────────────────
-- Encrypts a plain-text Aadhaar number and stores it.
-- Key is fetched from Supabase Vault (secret: "aadhaar_key").
-- Only the last 4 digits are stored in clear text for display.
--
-- Usage: select store_aadhaar(p_kyc_record_id, p_aadhaar_plain)
create or replace function store_aadhaar(
  p_kyc_id       uuid,
  p_aadhaar_plain text   -- 12-digit Aadhaar as plain text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key  text;
  v_last4 char(4);
begin
  -- Validate format: 12 digits
  if p_aadhaar_plain !~ '^\d{12}$' then
    raise exception 'Invalid Aadhaar format';
  end if;

  -- Retrieve key from Supabase Vault
  -- Requires: select vault.decrypted_secrets where name = 'aadhaar_key'
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'aadhaar_key'
  limit 1;

  if v_key is null then
    raise exception 'aadhaar_key not found in Vault';
  end if;

  v_last4 := right(p_aadhaar_plain, 4);

  update kyc_records set
    aadhaar_encrypted = pgp_sym_encrypt(p_aadhaar_plain, v_key),
    aadhaar_last4     = v_last4,
    updated_at        = now()
  where id = p_kyc_id
    and user_id = auth.uid();  -- only owner may store their own Aadhaar

  if not found then
    raise exception 'KYC record not found or unauthorized';
  end if;
end;
$$;

-- ── decrypt_aadhaar ───────────────────────────────────────
-- Returns the plain-text Aadhaar for a given KYC record.
-- Restricted to admin / super_admin roles only.
-- Logs every access to audit_log.
create or replace function decrypt_aadhaar(p_kyc_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key       text;
  v_encrypted bytea;
  v_plain     text;
  v_caller    uuid := auth.uid();
begin
  -- Only admins may decrypt
  if not (select is_admin()) then
    raise exception 'Unauthorized: admin role required';
  end if;

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'aadhaar_key'
  limit 1;

  if v_key is null then
    raise exception 'aadhaar_key not found in Vault';
  end if;

  select aadhaar_encrypted into v_encrypted
  from kyc_records
  where id = p_kyc_id;

  if v_encrypted is null then
    return null;  -- not yet stored
  end if;

  v_plain := pgp_sym_decrypt(v_encrypted, v_key);

  -- Audit every decryption
  insert into audit_log (actor_id, actor, action, target, detail)
  values (
    v_caller,
    coalesce((select name from profiles where id = v_caller), 'Admin'),
    'aadhaar_decrypted',
    p_kyc_id::text,
    'KYC record decrypted by admin'
  );

  return v_plain;
end;
$$;

-- ── handle_new_user ───────────────────────────────────────
-- Auto-creates a profiles row when a new auth.users row appears.
-- Handles phone OTP users (phone set) and OAuth users (phone null).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, name, role)
  values (
    new.id,
    new.phone,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      'SETU User'
    ),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── rider_locations cleanup (pg_cron) ─────────────────────
-- Deletes GPS rows older than 48 hours every hour.
-- Keeps the table small for rural low-storage environments.
-- pg_cron must be enabled (done in schema.sql via CREATE EXTENSION).
--
-- NOTE: run this block once after pg_cron is enabled.
--       Supabase requires cron.schedule() to be called as postgres role.
select cron.schedule(
  'prune-rider-locations',          -- job name (unique)
  '0 * * * *',                       -- every hour at :00
  $$
    delete from public.rider_locations
    where recorded_at < now() - interval '48 hours';
  $$
);

-- ── set_default_address ──────────────────────────────────
-- Atomically unsets current default and sets new default.
-- Called via setDefaultAddress in api.js.
create or replace function set_default_address(
  p_user_id    uuid,
  p_address_id uuid
)
returns jsonb
language plpgsql
security definer
as $$
begin
  -- 1. Unset all defaults for this user
  update customer_addresses
     set is_default = false
   where user_id = p_user_id
     and is_default = true;

  -- 2. Set the new default
  update customer_addresses
     set is_default = true
   where id = p_address_id
     and user_id = p_user_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Address not found or unauthorized');
  end if;

  return jsonb_build_object('success', true);
end;
$$;
