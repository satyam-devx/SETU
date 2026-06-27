-- ═══════════════════════════════════════════════════════════════
-- Migration 048: server-side hourly order distribution (perf)
--
-- getTodayHourlyOrders() downloaded the created_at of EVERY order placed
-- today to the browser just to bucket them into 24 hours for the admin
-- dashboard bar chart. Bounded to one day, but on a busy day that is
-- still a needless payload. This RPC returns the per-hour counts only.
--
-- Admin-gated; SECURITY DEFINER so the cross-user aggregate is not
-- blocked by per-row RLS.
-- ═══════════════════════════════════════════════════════════════

create or replace function get_today_hourly_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('hour', hr, 'orders', c) order by hr), '[]'::jsonb)
  into v
  from (
    select extract(hour from created_at)::int as hr, count(*) as c
    from orders
    where created_at >= date_trunc('day', now())
    group by extract(hour from created_at)::int
  ) x;

  return v;
end;
$$;
grant execute on function get_today_hourly_orders() to authenticated;
