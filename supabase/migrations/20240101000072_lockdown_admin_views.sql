-- ═══════════════════════════════════════════════════════════════
-- Migration 072: Lock down the remaining exposed admin views
--
-- Found while verifying that migration 069's vendor-less draft
-- products actually stay admin-only until a vendor is assigned:
-- admin_products_view has no RLS of its own (views don't inherit
-- the base tables' RLS unless created with `security_invoker`, which
-- none of these were), and migration 039's blanket
-- `grant select on all tables in schema public to anon, authenticated`
-- applies to views too — so without an explicit REVOKE, this view is
-- queryable directly (e.g. `GET /rest/v1/admin_products_view`) by
-- anyone, entirely bypassing the products/vendors RLS that protects
-- the underlying tables. Same problem for admin_analytics,
-- daily_order_trend, and hourly_order_trend (platform-wide
-- revenue/GMV/order-count data).
--
-- Migration 019 already revoked this exact class of access for
-- admin_dashboard_stats, gating it instead through a SECURITY DEFINER
-- RPC (get_admin_stats()) that checks is_admin() before reading the
-- view — establishing this as the intended pattern — but never
-- extended it to these other three admin-only views.
--
-- IMPORTANT #1: unlike admin_dashboard_stats, admin_products_view,
-- daily_order_trend, and hourly_order_trend were being queried
-- *directly* by the admin frontend (`.from('admin_products_view')`
-- etc. in src/lib/api.js) — a naive blanket REVOKE here would have
-- broken the admin product list and the analytics trend charts for
-- every admin/super_admin. Fixed with RPC wrappers instead (below),
-- matching get_admin_stats(); PostgREST lets a function returning
-- `setof <view>` be queried with the same .eq()/.ilike()/.range()
-- filters as the view itself, so the api.js call sites only needed
-- to swap .from(view) for .rpc(fn).
--
-- IMPORTANT #2, a second gap this migration also closes: every
-- existing `is_admin()`-gated function in this codebase (including
-- get_admin_stats() itself) uses the form:
--     if not is_admin() then raise exception ... end if;
-- For an anonymous/anon-role caller, auth.uid() is null, so
-- get_my_role() returns null and is_admin() returns null — and in
-- PL/pgSQL, `IF <null-or-false>` skips the THEN branch exactly like
-- `false` does, so the RAISE EXCEPTION is silently skipped and
-- execution falls through as if the caller *were* authorized.
-- Combined with PostgreSQL's default `GRANT EXECUTE ... TO PUBLIC`
-- on every newly created function (which a plain
-- `grant execute ... to authenticated` does not revoke — migration
-- 035's own root-cause note explains this exact trap), a function
-- written this way is callable by anon and, if it also forgets to
-- revoke PUBLIC, does not actually deny them. The four new functions
-- below use `coalesce(is_admin(), false)` and explicitly revoke
-- PUBLIC/anon EXECUTE, closing both holes together. This migration
-- does not attempt to patch the ~12 other pre-existing functions
-- sharing the `if not is_admin()` phrasing — that is a larger,
-- separate audit, out of scope for this change, and is called out
-- explicitly to the team rather than silently left alongside a
-- narrower fix.
-- ═══════════════════════════════════════════════════════════════

create or replace function get_admin_products()
returns setof admin_products_view
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Unauthorized: admin role required';
  end if;
  return query select * from admin_products_view;
end;
$$;
revoke execute on function get_admin_products() from public, authenticated, anon;
grant execute on function get_admin_products() to authenticated;

create or replace function get_daily_order_trend()
returns setof daily_order_trend
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Unauthorized: admin role required';
  end if;
  return query select * from daily_order_trend;
end;
$$;
revoke execute on function get_daily_order_trend() from public, authenticated, anon;
grant execute on function get_daily_order_trend() to authenticated;

create or replace function get_hourly_order_trend()
returns setof hourly_order_trend
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Unauthorized: admin role required';
  end if;
  return query select * from hourly_order_trend;
end;
$$;
revoke execute on function get_hourly_order_trend() from public, authenticated, anon;
grant execute on function get_hourly_order_trend() to authenticated;

-- admin_analytics already has a preferred, already-gated RPC path
-- (get_live_admin_analytics(), migration 011) that src/lib/api.js
-- tries first — the raw view is only a fallback explicitly commented
-- as being "for older schema". Give it the same wrapper for
-- consistency/defense-in-depth rather than leave the view reachable.
create or replace function get_admin_analytics_snapshot()
returns setof admin_analytics
language plpgsql
security definer
set search_path = public
as $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Unauthorized: admin role required';
  end if;
  return query select * from admin_analytics;
end;
$$;
revoke execute on function get_admin_analytics_snapshot() from public, authenticated, anon;
grant execute on function get_admin_analytics_snapshot() to authenticated;

-- Close the same PUBLIC-execute gap on the pre-existing
-- get_admin_stats() this migration's wrappers were modeled on —
-- it only ever received `grant ... to authenticated`, never a
-- revoke of the PUBLIC execute every function gets by default, and
-- shares the same null-short-circuit pattern. Fixed in place rather
-- than left inconsistent with the functions added right next to it.
create or replace function get_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Unauthorized: admin role required';
  end if;
  select to_jsonb(s) into v from admin_dashboard_stats s where s.id = 1;
  return coalesce(v, jsonb_build_object('stale', true));
end;
$$;
revoke execute on function get_admin_stats() from public, authenticated, anon;
grant execute on function get_admin_stats() to authenticated;

-- Now safe to revoke direct table access — every legitimate read
-- goes through one of the coalesce(is_admin(), false)-gated
-- functions above.
revoke all on admin_products_view  from authenticated, anon;
revoke all on admin_analytics      from authenticated, anon;
revoke all on daily_order_trend    from authenticated, anon;
revoke all on hourly_order_trend   from authenticated, anon;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'security_migration', 'views', 'view',
  'migration_072: revoked anon/authenticated SELECT on admin_products_view, admin_analytics, daily_order_trend, hourly_order_trend (were readable directly, bypassing base-table RLS). Added is_admin()-gated RPC wrappers and updated the frontend to call them. Also fixed a null-short-circuit in the is_admin() check (affects get_admin_stats() and ~12 other pre-existing functions using the same if not is_admin() phrasing — only get_admin_stats() and these 4 new functions were fixed here; the rest need a dedicated follow-up audit) and revoked the PUBLIC execute grant every Postgres function receives by default, which a plain grant-to-authenticated does not remove (see migration 035).'
);
