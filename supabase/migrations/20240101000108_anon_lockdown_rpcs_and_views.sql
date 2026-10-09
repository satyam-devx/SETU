-- ═══════════════════════════════════════════════════════════════
-- Migration 108 — AUDIT REMEDIATION (CRITICAL): unauthenticated access
--
-- Found by probing the LIVE production database as the `anon` role (every probe
-- ran inside a transaction that was rolled back; random UUIDs only):
--
--  A-01 [CRITICAL] ~96 SECURITY DEFINER RPCs were executable by `anon` (the
--       public key shipped in the frontend bundle). Many of them treat
--       `auth.uid() IS NULL` as "trusted backend call", e.g.
--           pay_from_wallet:        if auth.uid() is not null and p_user_id <> auth.uid() then raise …
--           update_order_status:    v_is_backend := (auth.uid() is null)
--           cancel_order_with_refund, set_default_address: same convention
--       An unauthenticated request ALSO has auth.uid() = NULL, so the guard is
--       skipped: anyone could debit another user's wallet (pay_from_wallet),
--       drive any order's status (update_order_status), cancel + refund orders
--       (cancel_order_with_refund) or change anyone's default address
--       (set_default_address) given a target UUID. Confirmed live: each probe
--       "REACHED BODY" past the identity check.
--       Earlier migrations tried REVOKE … FROM authenticated, anon, which is a
--       no-op while PUBLIC holds EXECUTE (see migration 035's own note).
--
--  V-01 [HIGH] Seven analytics / reconciliation relations were SELECT-able by
--       anon + authenticated, six of them SECURITY DEFINER views (bypass RLS),
--       one a materialized view (no RLS at all): analytics_daily_*_metrics,
--       reconciliation_dashboard (live row), admin_dashboard_stats (live row).
--       Migration 072 locked them, but they were (re)created afterwards with
--       default grants. Nothing in src/, supabase/functions or server/ reads
--       them directly (the admin UI uses is_admin()-gated RPC wrappers), so the
--       lockdown is behaviour-neutral.
--
-- FIX
--   • Revoke EXECUTE from PUBLIC and anon on every SECURITY DEFINER function in
--     `public` that anon can currently execute, except an explicit allow-list
--     of pre-login functions and the RLS helper functions (which policies and
--     storage policies evaluate for anon). `authenticated` and `service_role`
--     keep EXECUTE exactly where they had it before — functions that were
--     already service-only are NOT re-opened.
--   • Revoke SELECT on the seven relations from PUBLIC/anon/authenticated,
--     grant to service_role only. category_previews is public catalog data by
--     design (migration 073) and stays public, but becomes security_invoker.
--   • Change the default so FUTURE functions are not anon-executable.
--   • Pin search_path on the seven trigger/helper functions flagged by the
--     Supabase linter.
-- Idempotent.
-- ═══════════════════════════════════════════════════════════════

-- ── A-01: anon lockdown for SECURITY DEFINER RPCs ───────────────
do $$
declare
  r record;
  v_anon_allow text[] := array[
    -- pre-login: settings, feature flags, fee preview, client error reporting, IP check
    'get_public_settings', 'my_feature_flags', 'is_feature_enabled', 'get_fee_config',
    'log_client_error', 'is_ip_blocked',
    -- helpers evaluated inside RLS / storage policies for every role (return nothing for anon)
    'get_my_profile', 'get_my_role', 'get_my_village_id', 'has_permission', 'is_admin',
    'current_user_permissions'
  ];
begin
  for r in
    select p.oid::regprocedure::text as sig,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_had
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and p.prorettype <> 'trigger'::regtype
       and not (p.proname = any (v_anon_allow))
       and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    if r.auth_had then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ── Future functions must not be anon-executable by default ─────
do $$
begin
  execute 'alter default privileges for role postgres in schema public revoke execute on functions from public, anon';
exception when others then
  raise notice 'could not alter default function privileges (%): grant EXECUTE explicitly on new functions', sqlerrm;
end $$;

-- ── V-01: analytics / reconciliation relations → service_role only ─
do $$
declare
  v text;
begin
  foreach v in array array[
    'analytics_daily_order_metrics', 'analytics_daily_payment_metrics',
    'analytics_daily_delivery_metrics', 'analytics_daily_financial_metrics',
    'reconciliation_dashboard', 'admin_dashboard_stats'
  ] loop
    if to_regclass('public.' || v) is not null then
      execute format('revoke all on public.%I from public, anon, authenticated', v);
      execute format('grant select on public.%I to service_role', v);
    end if;
  end loop;
end $$;

-- Public catalog data by design (migration 073): keep readable, but evaluate with the
-- caller's privileges so it can never become an RLS bypass.
do $$
begin
  if to_regclass('public.category_previews') is not null then
    execute 'alter view public.category_previews set (security_invoker = true)';
  end if;
end $$;

-- ── Linter: pin search_path on trigger / helper functions ───────
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('update_cod_deposits_updated_at', 'set_customer_addresses_updated_at',
                         'enforce_single_default_address', 'promote_address_after_default_delete',
                         'compute_fee_split', 'prevent_audit_log_mutation', 'prevent_mutation')
  loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'anon_lockdown_108',
  'migration_108: revoked PUBLIC/anon EXECUTE on SECURITY DEFINER RPCs (allow-list kept for pre-login functions + RLS helpers; authenticated/service_role grants preserved), locked analytics/reconciliation views to service_role, category_previews now security_invoker, default function privileges no longer anon-executable.'
);
