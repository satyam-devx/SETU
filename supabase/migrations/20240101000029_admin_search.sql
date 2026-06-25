-- ═══════════════════════════════════════════════════════════════
-- Migration 029: Admin global search (command palette backend)
--
-- A single, RLS-safe search across the platform's core entities for the
-- admin command palette. security definer so it returns a unified result
-- set in one round trip; gated to admins/super_admins.
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
  ) r;

  return v;
end;
$$;
grant execute on function admin_global_search(text) to authenticated;

insert into audit_log (actor_id, actor, action, target, detail)
values (null, 'system', 'ops_migration', 'search',
  'migration_029: admin_global_search — unified RLS-safe search across users/vendors/orders/coupons for the command palette (admin-gated)');
