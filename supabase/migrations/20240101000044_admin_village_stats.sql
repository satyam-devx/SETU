-- ═══════════════════════════════════════════════════════════════
-- Migration 044: server-side admin village stats (perf)
--
-- getAdminVillages() previously fetched ALL orders and ALL vendors to
-- the browser and joined them client-side per village — O(villages ×
-- orders) work plus a full download that grows unbounded with traffic.
--
-- This RPC computes per-village counts in SQL (indexed GROUP BY on
-- orders.village_id / vendors.village_id) and returns one small row per
-- village. Admin-gated (villages.view or is_admin); SECURITY DEFINER so
-- the aggregate counts aren't blocked by per-row RLS.
-- ═══════════════════════════════════════════════════════════════

create or replace function get_admin_village_stats()
returns table (
  id             text,
  name           text,
  block          text,
  district       text,
  is_active      boolean,
  population     integer,
  total_orders   bigint,
  total_vendors  bigint,
  active_vendors bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (has_permission('villages.view') or is_admin()) then
    raise exception 'Unauthorized: villages.view required';
  end if;

  return query
    select v.id, v.name, v.block, v.district, v.is_active, v.population,
           coalesce(o.cnt, 0)::bigint   as total_orders,
           coalesce(vn.total, 0)::bigint as total_vendors,
           coalesce(vn.active, 0)::bigint as active_vendors
    from villages v
    left join (
      select village_id, count(*) as cnt
      from orders
      group by village_id
    ) o on o.village_id = v.id
    left join (
      select village_id, count(*) as total, count(*) filter (where is_open) as active
      from vendors
      group by village_id
    ) vn on vn.village_id = v.id
    order by v.name;
end;
$$;
grant execute on function get_admin_village_stats() to authenticated;

-- Support the per-village GROUP BY aggregations (idempotent).
create index if not exists idx_orders_village_id  on orders(village_id);
create index if not exists idx_vendors_village_id on vendors(village_id);
