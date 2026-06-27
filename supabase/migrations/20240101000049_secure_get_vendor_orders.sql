-- ═══════════════════════════════════════════════════════════════
-- Migration 049: lock down get_vendor_orders (IDOR + search_path)
--
-- get_vendor_orders(p_vendor_id) in initial_schema.sql is SECURITY
-- DEFINER, language sql, with NO caller authorization and NO
-- `set search_path`. Any authenticated user could call
--   supabase.rpc('get_vendor_orders', { p_vendor_id: '<any vendor>' })
-- and read that vendor's entire order book — customer names, villages,
-- payment method/status, totals and line items. A classic IDOR /
-- sensitive-data exposure.
--
-- Nothing in src/ actually calls it (the vendor portal uses a direct,
-- RLS-governed `from('orders')` query), so it is dead-but-dangerous
-- code. Rather than only revoke it, we ship the real guarded version:
-- caller must own p_vendor_id OR be an admin (backend/service_role,
-- where auth.uid() is null, stays unrestricted). Adds `set search_path`
-- to close the definer search-path hijack surface.
--
-- Return signature is unchanged (create-or-replace requires identical
-- columns).
-- ═══════════════════════════════════════════════════════════════

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
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Authorization: a logged-in caller must own this vendor or be an admin.
  -- Backend / service_role calls (auth.uid() is null) are unrestricted.
  if auth.uid() is not null
     and not exists (select 1 from vendors where id = p_vendor_id and owner_id = auth.uid())
     and not is_admin()
  then
    raise exception 'Unauthorized: not your vendor';
  end if;

  return query
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
end;
$$;
grant execute on function get_vendor_orders(uuid) to authenticated;
