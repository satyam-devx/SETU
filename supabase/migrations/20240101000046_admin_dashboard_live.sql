-- ═══════════════════════════════════════════════════════════════
-- Migration 046: live admin dashboard aggregate (perf)
--
-- getAdminDashboardStats() downloaded the ENTIRE orders, vendors, riders,
-- support_tickets and cod_deposits tables to the browser on every admin
-- dashboard load, then aggregated client-side. The orders table grows
-- unbounded, so this degrades badly with traffic.
--
-- This RPC computes every figure server-side (indexed COUNT/SUM) and
-- returns one small jsonb. Admin-gated; SECURITY DEFINER so the
-- cross-user aggregates aren't blocked by per-row RLS.
--
-- (getAdminStats() already uses the 5-min admin_dashboard_stats MV for
-- the headline numbers; this is the richer live view with COD/ticket
-- breakdowns the MV doesn't carry.)
-- ═══════════════════════════════════════════════════════════════

create or replace function get_admin_dashboard_live()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v       jsonb;
  v_today timestamptz := date_trunc('day', now());
begin
  if not is_admin() then
    raise exception 'Unauthorized: admin required';
  end if;

  select jsonb_build_object(
    'totalOrders',     (select count(*) from orders),
    'activeOrders',    (select count(*) from orders where status not in ('delivered','cancelled')),
    'pendingAssign',   (select count(*) from orders where rider_id is null and status not in ('delivered','cancelled')),
    'todayOrders',     (select count(*) from orders where created_at >= v_today),
    'todayRevenue',    (select coalesce(sum(total),0) from orders where created_at >= v_today and status <> 'cancelled'),
    'totalRevenue',    (select coalesce(sum(total),0) from orders where status <> 'cancelled'),
    'activeVendors',   (select count(*) from vendors where is_open),
    'totalVendors',    (select count(*) from vendors),
    'pendingVendors',  (select count(*) from vendors where not is_verified and kyc_status <> 'rejected'),
    'onlineRiders',    (select count(*) from riders where is_online),
    'totalRiders',     (select count(*) from riders),
    'openTickets',     (select count(*) from support_tickets where status = 'open'),
    'totalCOD',        (select coalesce(sum(total),0) from orders where payment_method = 'COD' and status = 'delivered'),
    'pendingDeposits', (select coalesce(sum(amount),0) from cod_deposits where status = 'pending_confirmation'),
    'riderCODBalance', (select coalesce(sum(cod_balance),0) from riders)
  ) into v;

  return v;
end;
$$;
grant execute on function get_admin_dashboard_live() to authenticated;
