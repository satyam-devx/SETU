-- ═══════════════════════════════════════════════════════════════
-- Migration 063 (PASS 9 — Part 2): search_path hardening for 7
-- SECURITY DEFINER functions with mutable search_path
--
-- PASS 8 LIVE FINDING
-- check_rate_limit, get_my_role, get_my_village_id, is_admin,
-- place_order, prune_rate_limit_hits, review_image are all
-- SECURITY DEFINER with no explicit search_path, AND this pass
-- independently confirmed the exploit precondition is live-present:
-- both `authenticated` and `anon` can CREATE objects directly in the
-- `public` schema (has_schema_privilege(...,'public','CREATE') =
-- true for both). is_admin()/get_my_role() specifically underpin the
-- majority of this schema's RLS policies (100+ and 22+ policy bodies
-- respectively, per repository analysis), making them the highest-
-- value targets in this batch.
--
-- DEPENDENCY CHECK PERFORMED BEFORE THIS MIGRATION (per instruction
-- not to blindly assume search_path=public is safe)
-- Every unqualified table/function reference in all 7 function
-- bodies was read directly from live pg_proc (not from repository
-- assumption) and confirmed to resolve entirely within the `public`
-- schema:
--   check_rate_limit      -> rate_limit_hits (public)
--   get_my_role            -> profiles (public)
--   get_my_village_id      -> profiles (public)
--   is_admin                -> get_my_role() (public)
--   place_order             -> orders, order_items, products,
--                             audit_log, order_number_seq (all public)
--   prune_rate_limit_hits  -> rate_limit_hits (public)
--   review_image             -> is_admin() (public), image_moderation
--                             (public)
-- auth.uid() is already schema-qualified in every body that uses it
-- and is therefore unaffected by search_path. No function in this
-- batch references any object outside `public` unqualified, so
-- `SET search_path = public` is confirmed sufficient and safe for
-- all 7 -- no broader search path (e.g. including `extensions`) is
-- needed.
--
-- Every function is reproduced byte-for-byte from its current live
-- definition (re-read via pg_get_functiondef immediately before
-- writing this migration) with only `SET search_path TO 'public'`
-- added. Grants, ownership, and SECURITY DEFINER status are
-- unchanged; CREATE OR REPLACE preserves existing ACLs.
--
-- place_order is hardened here too, for defense-in-depth consistency,
-- even though it currently has no EXECUTE grant to any role (verified
-- live this pass: anon_exec=false, auth_exec=false) and is therefore
-- not reachable by any client today.
-- ═══════════════════════════════════════════════════════════════

create or replace function check_rate_limit(p_key text, p_max_count integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into rate_limit_hits (bucket_key) values (p_key);

  select count(*) into v_count
  from rate_limit_hits
  where bucket_key = p_key
    and occurred_at > now() - (p_window_seconds || ' seconds')::interval;

  return v_count <= p_max_count;
end;
$$;

create or replace function get_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function get_my_village_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select village_id from profiles where id = auth.uid()
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select get_my_role() in ('admin','super_admin')
$$;

create or replace function place_order(
  p_customer_id uuid, p_customer_name text, p_vendor_id uuid, p_vendor_name text,
  p_village_id text, p_village text, p_payment_method text,
  p_subtotal numeric, p_delivery_fee numeric, p_platform_fee numeric, p_total numeric,
  p_items jsonb, p_delivery_address text default null::text, p_use_credit boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id     uuid;
  v_order_number text;
  v_item         jsonb;
  v_result       jsonb;
begin
  v_order_id     := gen_random_uuid();
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

create or replace function prune_rate_limit_hits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rate_limit_hits where occurred_at < now() - interval '1 day';
$$;

create or replace function review_image(p_image_id uuid, p_status text, p_reason text default null::text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin role required';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;

  update image_moderation
    set status        = p_status,
        reviewed_by   = auth.uid(),
        reviewed_at   = now(),
        reject_reason = p_reason
  where id = p_image_id;
end;
$$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'check_rate_limit,get_my_role,get_my_village_id,is_admin,place_order,prune_rate_limit_hits,review_image',
  'migration_063 (PASS 9 Part 2): added explicit SET search_path = public to 7 SECURITY DEFINER functions found live with mutable search_path, after confirming (a) every unqualified reference in each body resolves within public, and (b) the exploit precondition (authenticated/anon CREATE on public) is live-present. is_admin/get_my_role are the highest-value targets given their use across 100+ RLS policy bodies. Logic, grants, and ownership unchanged -- defense-in-depth only.'
);
