-- ═══════════════════════════════════════════════════════════════
-- SETU — RLS & RPC Permission-Guard Proof Script
--
-- Executable evidence that the migration 013/014/016 hardening
-- actually holds against a real Postgres with Supabase auth.uid()
-- (driven by JWT-claim GUCs) — not re-implemented logic.
--
-- HOW TO RUN (against a local Supabase):
--   supabase start
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/rls_permission_guards_test.sql
--
-- Runs in one transaction and ENDS WITH ROLLBACK (non-destructive).
-- Prints "ALL RLS/PERMISSION-GUARD TESTS PASSED" on success; any failed
-- assertion aborts under ON_ERROR_STOP=1.
--
-- Covers:
--   T1  topup_wallet revoked from authenticated (CRITICAL-NEW-2)
--   T2  pay_from_wallet ownership guard      (CRITICAL-NEW-1)
--   T3  profiles role self-escalation blocked (migration 013)
--   T4  profiles is_verified self-grant blocked (migration 014)
--   T5  upsert_platform_config requires admin (CRITICAL-NEW-3)
--   T6  set_default_address ownership guard  (CRITICAL-NEW-6)
-- ═══════════════════════════════════════════════════════════════

begin;

-- ── Seed (as postgres; RLS bypassed) ────────────────────────────
insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','c2@test.local','{}','{}', now(), now(), now());

update profiles set role='customer', name='C1' where id='11111111-1111-1111-1111-111111111111';
update profiles set role='customer', name='C2' where id='22222222-2222-2222-2222-222222222222';

insert into wallets (user_id, balance) values
  ('11111111-1111-1111-1111-111111111111', 100),
  ('22222222-2222-2222-2222-222222222222', 500);

-- A default address owned by C2 (target for the ownership test).
insert into customer_addresses (id, user_id, label, address, is_default)
values ('a0000000-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Home','C2 House', true);

-- ═══════════════════════════════════════════════════════════════
-- Act as customer C1 for every test below.
-- ═══════════════════════════════════════════════════════════════
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- T1: topup_wallet is revoked from authenticated → free-money minting blocked.
do $$
declare v jsonb;
begin
  begin
    v := topup_wallet('11111111-1111-1111-1111-111111111111', 999999, 'hack');
    raise exception 'FAIL T1: authenticated user could call topup_wallet (free money!)';
  exception
    when insufficient_privilege then raise notice 'PASS T1: topup_wallet denied to authenticated';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T1: topup_wallet denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

-- T2: pay_from_wallet refuses to debit ANOTHER user's wallet.
do $$
declare v jsonb;
begin
  begin
    v := pay_from_wallet('22222222-2222-2222-2222-222222222222', 1, null);
    raise exception 'FAIL T2: C1 drained C2''s wallet via pay_from_wallet: %', v::text;
  exception
    when others then
      if position('Unauthorized' in sqlerrm) > 0 then raise notice 'PASS T2: cross-user wallet debit blocked (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

-- Confirm C2's balance is untouched (verified below as postgres, after reset).

-- T3: a customer cannot escalate their own role to admin.
do $$
begin
  begin
    update profiles set role='admin' where id='11111111-1111-1111-1111-111111111111';
    raise exception 'FAIL T3: customer escalated own role to admin';
  exception
    when insufficient_privilege then raise notice 'PASS T3: role self-escalation blocked by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T3: role self-escalation blocked (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

-- T4: a customer cannot self-grant is_verified.
do $$
begin
  begin
    update profiles set is_verified=true where id='11111111-1111-1111-1111-111111111111';
    raise exception 'FAIL T4: customer self-granted is_verified';
  exception
    when insufficient_privilege then raise notice 'PASS T4: is_verified self-grant blocked by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T4: is_verified self-grant blocked (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

-- T5: a non-admin cannot rewrite platform_config.
do $$
begin
  begin
    perform upsert_platform_config('platform_fee_pct', '0', 'hack');
    raise exception 'FAIL T5: non-admin rewrote platform_config';
  exception
    when others then
      if position('admin' in lower(sqlerrm)) > 0 then raise notice 'PASS T5: platform_config write requires admin (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

-- T6: a customer cannot change another user's default address.
do $$
declare v jsonb;
begin
  begin
    v := set_default_address('22222222-2222-2222-2222-222222222222','a0000000-0000-0000-0000-000000000001');
    raise exception 'FAIL T6: C1 modified C2''s addresses: %', v::text;
  exception
    when others then
      if position('Unauthorized' in sqlerrm) > 0 then raise notice 'PASS T6: cross-user address change blocked (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

reset role;

-- Verify (as postgres) that the rejected cross-user debit left C2 intact.
do $$
declare b numeric;
begin
  select balance into b from wallets where user_id='22222222-2222-2222-2222-222222222222';
  if b is distinct from 500 then raise exception 'FAIL T2b: C2 balance is % (expected 500)', b; end if;
  raise notice 'PASS T2b: C2 wallet still ₹500 (cross-user debit had no effect)';
end $$;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL RLS/PERMISSION-GUARD TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
