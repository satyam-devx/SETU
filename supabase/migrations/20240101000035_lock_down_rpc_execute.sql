-- ═══════════════════════════════════════════════════════════════
-- Migration 035: Close the PUBLIC-execute hole on restricted RPCs
--
-- ROOT CAUSE (security):
--   PostgreSQL automatically runs `GRANT EXECUTE ... TO PUBLIC` when a
--   function is created. Earlier migrations tried to lock money-movement
--   and admin RPCs with `REVOKE EXECUTE ... FROM authenticated, anon`,
--   but that is a NO-OP: authenticated/anon still inherit EXECUTE through
--   PUBLIC. So e.g. any logged-in user could call
--     supabase.rpc('topup_wallet', { p_user_id: auth.uid(), p_amount: 999999 })
--   and mint free wallet balance (caught by rls_permission_guards_test T1).
--
-- FIX:
--   For every RPC that is meant to be service-role-only or internal,
--   REVOKE EXECUTE FROM PUBLIC (the grant that actually matters) and,
--   except for the fully-retired place_order, GRANT EXECUTE TO
--   service_role so the server-side Edge Functions / admin backend that
--   legitimately invoke them keep working. SECURITY DEFINER functions
--   called internally by other functions run as the owner and are
--   unaffected by these grants.
--
-- Idempotent: REVOKE/GRANT are no-ops when already in the target state,
-- and the loop only touches functions that actually exist.
-- ═══════════════════════════════════════════════════════════════

do $$
declare
  r record;
  v_targets text[] := array[
    'topup_wallet',
    'credit_wallet',
    'place_order',
    '_set_internal_payment_flag',
    'compute_fee_split',
    'record_delivery_split',
    'initiate_vendor_payout',
    'confirm_vendor_payout',
    'create_rider_payment_batch',
    'confirm_rider_payment',
    '_evaluate_coupon',
    'resolve_campaign_audience',
    '_dispatch_campaign_internal',
    'dispatch_due_campaigns',
    'flag_stuck_payment_events'
  ];
begin
  for r in
    select p.oid::regprocedure::text as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (v_targets)
  loop
    execute format('revoke execute on function %s from public, authenticated, anon', r.sig);
    -- place_order is intentionally retired with no legitimate caller —
    -- keep it locked to service_role too (no grant).
    if r.proname <> 'place_order' then
      execute format('grant execute on function %s to service_role', r.sig);
    end if;
  end loop;
end $$;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'rpc_execute_grants',
  'migration_035: revoked EXECUTE from PUBLIC on restricted RPCs (the no-op revoke-from-authenticated left PUBLIC intact); re-granted to service_role for server-side callers.'
);
