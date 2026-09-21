-- ═══════════════════════════════════════════════════════════════
-- Migration 084: fix create_order() overload ambiguity + missing
-- grant, both introduced by migration 083
--
-- PROBLEM 1 — overload ambiguity
-- Migration 083 added a 9th parameter (p_idempotency_key) to
-- create_order() via `create or replace function`. Postgres only
-- replaces a function IN PLACE when the new definition has the exact
-- same argument type list as an existing one. Changing the argument
-- COUNT (8 params → 9 params) doesn't replace anything — it silently
-- creates a SECOND, separate overload alongside the original 8-arg
-- one. Any call that doesn't name every parameter (which is most real
-- calls, positional or keyword — the entire point of default
-- parameters) can then no longer be resolved: Postgres can't tell
-- whether to fill in defaults against the 8-arg version or the 9-arg
-- version, and errors with "function create_order(...) is not
-- unique". This broke qa/sql/phase1_money_integrity_test.sql's
-- positional calls in CI.
--
-- PROBLEM 2 — missing grant (more serious: this one is silent)
-- create_order's `authenticated` execute grant has only ever been
-- issued against the 8-argument signature (migration 028:
-- `grant execute on function create_order(uuid, jsonb, text, text,
-- text, text, boolean, text) to authenticated`). A grant is tied to a
-- specific function signature, not the function name — it does NOT
-- carry over to a differently-shaped overload. So the 9-argument
-- version migration 083 introduced has never been granted execute
-- permission to `authenticated` at all. Once problem 1 above is
-- fixed and the ambiguous 8-arg overload is gone, every real
-- checkout call from the app (which always names p_idempotency_key,
-- so it can only ever resolve to the 9-arg version) would have
-- started failing with "permission denied for function create_order"
-- instead. Both problems have to be fixed together in this same
-- migration — fixing only the ambiguity would have made checkout
-- fail a different way instead of actually fixing it.
--
-- FIX
-- Drop the stale 8-argument overload, and explicitly grant execute
-- on the 9-argument version to `authenticated`.
-- ═══════════════════════════════════════════════════════════════

drop function if exists create_order(uuid, jsonb, text, text, text, text, boolean, text);

grant execute on function
  create_order(uuid, jsonb, text, text, text, text, boolean, text, text)
  to authenticated;

insert into audit_log (actor_id, actor, action, target, target_type, detail)
values (
  null, 'system', 'schema_migration', 'create_order', 'function',
  'migration_084: dropped the stale 8-argument create_order() overload left behind by migration 083 (CREATE OR REPLACE FUNCTION does not replace a function when the argument count changes — it creates a new overload instead, causing "function create_order(...) is not unique" for any caller that does not name every parameter). Also granted execute on the surviving 9-argument version to authenticated, which had never been granted at all since grants are tied to a specific signature and do not carry over between overloads — without this grant, real checkout calls (which always pass p_idempotency_key by name and so can only resolve to the 9-arg version) would have started failing with a permission error the moment the ambiguity above was resolved.'
);
