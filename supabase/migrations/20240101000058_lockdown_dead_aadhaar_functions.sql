-- ═══════════════════════════════════════════════════════════════
-- Migration 058 (PASS 5 — P3 store_aadhaar/decrypt_aadhaar decision;
-- discovered issue, tagged PASS-5-DISCOVERED)
--
-- CONTEXT
-- Pass 1-4 established that store_aadhaar()/decrypt_aadhaar()
-- (migration 001) have no caller anywhere in the app — verify-aadhaar
-- (the live KYC flow) never calls store_aadhaar and never persists a
-- raw Aadhaar number locally, delegating identity verification to
-- SurePass entirely. These two functions were treated as dead/
-- orphaned-by-design-supersession.
--
-- NEWLY DISCOVERED THIS PASS
-- Migration 035 ("Close the PUBLIC-execute hole on restricted RPCs")
-- explicitly revoked EXECUTE FROM PUBLIC on every other
-- service-role-only/internal RPC in the schema (topup_wallet,
-- credit_wallet, place_order, _evaluate_coupon, etc. — see its
-- v_targets list) specifically because Postgres grants EXECUTE to
-- PUBLIC by default on function creation, and an earlier REVOKE ...
-- FROM authenticated, anon (without also revoking FROM public) is a
-- no-op — PUBLIC-inherited execute still lets any authenticated
-- client call the function directly via supabase.rpc().
--
-- store_aadhaar and decrypt_aadhaar are NOT in migration 035's target
-- list, and no other migration revokes their PUBLIC execute grant
-- either. This means, as shipped, BOTH functions are currently
-- callable by any authenticated client:
--   • decrypt_aadhaar(uuid) has an internal `is_admin()` check, so a
--     non-admin caller is still rejected — no decryption exposure for
--     non-admins even though the function is technically reachable.
--   • store_aadhaar(uuid, text) has NO internal role check — only an
--     ownership filter on its UPDATE (`where id = p_kyc_id and
--     user_id = auth.uid()`), so a caller cannot write to someone
--     ELSE's KYC record, but CAN currently call
--     supabase.rpc('store_aadhaar', {...}) directly to write a raw,
--     unverified Aadhaar number into their OWN kyc_records row,
--     completely bypassing the intended SurePass verification flow —
--     something the "this machinery is dead" assumption in Pass 2-4
--     did not account for, because dead-in-the-app is not the same as
--     dead-at-the-database-grant-level, exactly the class of gap
--     migration 035 exists to close for every other function.
--
-- DECISION
-- Per Pass 4 instruction, this machinery is not casually deleted
-- (provenance/future-use is not fully clear, and the underlying
-- encrypted-Aadhaar column design may still be wanted later). Instead
-- it is formally locked down the same way migration 035 already
-- locks down every comparable internal/dead function: revoke EXECUTE
-- from PUBLIC, authenticated, and anon. Unlike most of migration 035's
-- targets, these are NOT re-granted to service_role either — nothing
-- in this codebase (Edge Functions included) currently calls them, so
-- there is no legitimate current caller to preserve access for. This
-- formally marks them intentionally-retained-but-unreachable rather
-- than leaving them unreachable only by omission, and closes the
-- concrete gap identified above.
--
-- Function bodies, the encrypted-Aadhaar column, and vault key lookup
-- are entirely unchanged — this is a grants-only migration.
-- ═══════════════════════════════════════════════════════════════

revoke execute on function store_aadhaar(uuid, text) from public, authenticated, anon;
revoke execute on function decrypt_aadhaar(uuid)      from public, authenticated, anon;

insert into audit_log (actor_id, actor, action, target, detail)
values (
  null, 'system', 'security_migration', 'store_aadhaar,decrypt_aadhaar',
  'migration_058 (PASS 5, discovered during P3 audit): store_aadhaar/decrypt_aadhaar were never included in migration 035''s PUBLIC-execute lockdown and were therefore callable by any authenticated client (store_aadhaar had no internal role check, only an ownership filter — a caller could write an unverified raw Aadhaar number into their own KYC record via direct RPC call, bypassing the intended SurePass verification flow). Both functions'' EXECUTE is now revoked from PUBLIC/authenticated/anon and not re-granted to any role, formally marking them intentionally-retained-but-unreachable. No caller existed for either function before this change, so no legitimate functionality is affected.'
);
