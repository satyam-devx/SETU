-- ═══════════════════════════════════════════════════════════════
-- Migration 033: Admin global search — extended coverage
--
-- Adds products and villages to admin_global_search() so the command
-- palette covers the full catalogue, not just users/vendors/orders/
-- coupons. Same security model (is_admin()-gated, ≤2-char floor,
-- 6 per kind).
-- ═══════════════════════════════════════════════════════════════

create or replace function admin_global_search(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := '%' || trim(p_query) || '%';
  v jsonb;
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin role required';
  end if;
  if length(coalesce(trim(p_query), '')) < 2 then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into v
  from (
    (select 'user'::text as kind, id::text as id,
            coalesce(name, '(no name)') as label,
            coalesce(phone, role) as sublabel, '/superadmin/users' as path
       from profiles
       where name ilike q or phone ilike q
       order by created_at desc limit 6)
    union all
    (select 'vendor', id::text, name, coalesce(category, ''), '/admin/vendors'
       from vendors where name ilike q
       order by created_at desc limit 6)
    union all
    (select 'order', id::text, order_number, coalesce(customer_name, status), '/admin/orders'
       from orders where order_number ilike q
       order by created_at desc limit 6)
    union all
    (select 'coupon', id::text, code,
            case when discount_type = 'percent' then discount_value || '% off' else '₹' || discount_value || ' off' end,
            '/admin/coupons'
       from coupons where code ilike q
       order by created_at desc limit 6)
    union all
    (select 'product', id::text, name, coalesce(category, ''), '/admin/products'
       from products where name ilike q
       order by created_at desc limit 6)
    union all
    (select 'village', id::text, name, coalesce(district, state), '/admin/villages'
       from villages where name ilike q
       order by name limit 6)
  ) r;

  return v;
end;
$$;
grant execute on function admin_global_search(text) to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (null, 'system', 'ops_migration', 'search',
  'migration_033: admin_global_search extended to products + villages (now 6 entity kinds)');
