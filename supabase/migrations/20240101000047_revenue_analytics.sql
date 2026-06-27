-- ═══════════════════════════════════════════════════════════════
-- Migration 047: server-side revenue analytics aggregate (perf)
--
-- getRevenueAnalytics({days}) downloaded EVERY non-cancelled order from
-- the last N days (up to 90) to the browser — created_at, total,
-- platform_fee, status, payment_method, vendor_name, village — then
-- three separate admin screens each re-aggregated client-side into
-- daily trend / payment mix / top vendors / village breakdown.
--
-- For a live platform that payload grows without bound. This RPC does
-- all of it server-side (indexed scan + GROUP BY) and returns one small
-- jsonb. Admin-gated; SECURITY DEFINER so cross-user aggregation is not
-- blocked by per-row RLS.
--
-- Aggregates over non-cancelled orders only — matches the prior query's
-- `.not('status','eq','cancelled')` filter exactly.
-- ═══════════════════════════════════════════════════════════════

create or replace function get_revenue_analytics(p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := now() - (greatest(coalesce(p_days, 30), 1) || ' days')::interval;
  v jsonb;
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin required';
  end if;

  with base as (
    select created_at, total, payment_method, vendor_name, village
    from orders
    where created_at >= v_since
      and status <> 'cancelled'
  ),
  daily as (
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
           count(*)                  as orders,
           coalesce(sum(total), 0)   as revenue
    from base
    group by date_trunc('day', created_at)
  ),
  pay as (
    select coalesce(payment_method, 'unknown') as name, count(*) as c
    from base
    group by coalesce(payment_method, 'unknown')
  ),
  vend as (
    select vendor_name, count(*) as c, coalesce(sum(total), 0) as rev
    from base
    where vendor_name is not null
    group by vendor_name
    order by rev desc
    limit 10
  ),
  vill as (
    select village, count(*) as c
    from base
    where village is not null
    group by village
    order by c desc
    limit 10
  )
  select jsonb_build_object(
    'total_revenue', (select coalesce(sum(revenue), 0) from daily),
    'total_orders',  (select coalesce(sum(orders), 0)  from daily),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', date, 'orders', orders, 'revenue', revenue) order by date), '[]'::jsonb)
      from daily
    ),
    'payment_mix', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'value', c)), '[]'::jsonb)
      from pay
    ),
    'top_vendors', (
      select coalesce(jsonb_agg(jsonb_build_object('name', vendor_name, 'orders', c, 'revenue', rev) order by rev desc), '[]'::jsonb)
      from vend
    ),
    'villages', (
      select coalesce(jsonb_agg(jsonb_build_object('name', village, 'orders', c) order by c desc), '[]'::jsonb)
      from vill
    )
  ) into v;

  return v;
end;
$$;
grant execute on function get_revenue_analytics(int) to authenticated;
