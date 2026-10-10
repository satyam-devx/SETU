-- ═══════════════════════════════════════════════════════════════
-- Migration 109 — AUDIT REMEDIATION: NULL-logic guard bypass + open outbox queue
--
-- Found by sweeping the LIVE database as an authenticated user (every probe ran in a
-- rolled-back transaction):
--
--  A-02 [MEDIUM-HIGH] is_admin() is `select get_my_role() in ('admin','super_admin')`.
--       For an authenticated identity with NO profile row get_my_role() is NULL, so
--       is_admin() is NULL, and every guard written as
--           if not is_admin() then raise exception …
--           if not (has_permission('finance.view') or is_admin()) then raise exception …
--       evaluates `IF NULL` — which does NOT raise. Eighteen admin RPCs
--       (get_finance_overview, get_revenue_analytics, get_admin_dashboard_live,
--       get_security_overview, get_admin_village_stats, get_observability_dashboard,
--       get_payment_queue_health, …) therefore returned platform-wide GMV, revenue,
--       order / rider counts and security counters to such an identity. Real customers
--       were refused correctly. Today exactly one legacy auth user (created before the
--       signup trigger existed) has no profile, but any future gap (failed trigger, manual
--       user) re-opens it.
--       Fix: is_admin() can never return NULL. This single change repairs all 30
--       functions that use it. get_village_dashboard_stats additionally compared
--       get_my_role() inline and gets an explicit COALESCE.
--
--  A-03 [HIGH] setu_claim_outbox_batch() — the Kafka worker's queue claim, which returns
--       full-row event snapshots and leases them — was executable by every logged-in user
--       (confirmed with a real customer account). Service-only.
--
-- Idempotent (CREATE OR REPLACE / REVOKE).
-- ═══════════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(get_my_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.get_village_dashboard_stats(p_village_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v jsonb;
begin
  -- NULL-safe: an identity with no role must be refused, not waved through by `IF NULL`.
  if not coalesce(
    is_admin()
    or (get_my_role() = 'anchor' and get_my_village_id() = p_village_id),
    false
  ) then
    raise exception 'Unauthorized';
  end if;

  select jsonb_build_object(
    'totalOrders',   (select count(*) from orders where village_id = p_village_id),
    'activeOrders',  (select count(*) from orders where village_id = p_village_id and status not in ('delivered','cancelled')),
    'totalGMV',      (select coalesce(sum(total),0) from orders where village_id = p_village_id and status <> 'cancelled'),
    'totalVendors',  (select count(*) from vendors where village_id = p_village_id),
    'activeVendors', (select count(*) from vendors where village_id = p_village_id and is_open),
    'totalRiders',   (select count(*) from riders  where village_id = p_village_id),
    'onlineRiders',  (select count(*) from riders  where village_id = p_village_id and is_online),
    'pendingKYC',    (select count(*) from kyc_records k join profiles pr on pr.id = k.user_id
                       where pr.village_id = p_village_id and k.status in ('pending','submitted'))
  ) into v;
  return v;
end;
$$;

-- A-03: the outbox claim is for the service-role worker only.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'setu_claim_outbox_batch'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'null_safe_admin_guards_109',
  'migration_109: is_admin() is now NULL-safe (fixes `if not is_admin()` guards for profile-less identities across 30 functions); get_village_dashboard_stats guard coalesced; setu_claim_outbox_batch is service-role only.'
);
