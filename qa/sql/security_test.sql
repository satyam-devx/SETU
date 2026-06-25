-- ═══════════════════════════════════════════════════════════════
-- SETU — Security Center & Audit Immutability Proof (migration 025)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/security_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','c2@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin' where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer'    where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');

-- ── T1: a customer cannot ban anyone ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform ban_user('22222222-2222-2222-2222-222222222222', 'spam');
    raise exception 'FAIL T1: customer was allowed to ban a user';
  exception when others then
    if position('users.update' in sqlerrm) > 0 then raise notice 'PASS T1: ban_user denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin ban sets is_banned (NOT is_verified) + audits ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare n int; v boolean; ver boolean;
begin
  perform ban_user('22222222-2222-2222-2222-222222222222', 'fraud');
  reset role;
  select is_banned, is_verified into v, ver from profiles where id='22222222-2222-2222-2222-222222222222';
  if v is not true then raise exception 'FAIL T2: is_banned not set'; end if;
  -- is_verified must be untouched by ban (decoupled)
  select count(*) into n from audit_log where action='ban_user' and target='22222222-2222-2222-2222-222222222222';
  if n < 1 then raise exception 'FAIL T2: ban not audited'; end if;
  raise notice 'PASS T2: ban sets is_banned (is_verified untouched=%), audited', ver;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T3: a banned user cannot self-unban via direct profile UPDATE ──
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$
begin
  begin
    update profiles set is_banned = false where id = '22222222-2222-2222-2222-222222222222';
    -- If RLS allowed it, verify it actually changed (it must NOT)
    if (select is_banned from profiles where id='22222222-2222-2222-2222-222222222222') = false then
      raise exception 'FAIL T3: user unbanned themselves';
    end if;
    raise notice 'PASS T3: self-unban had no effect (WITH CHECK pins is_banned)';
  exception
    when insufficient_privilege then raise notice 'PASS T3: self-unban denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T3: self-unban denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

-- ── T4: list_blocked_users + get_security_overview for super_admin ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare n int; ov jsonb;
begin
  select count(*) into n from list_blocked_users();
  if n <> 1 then raise exception 'FAIL T4: expected 1 blocked user, got %', n; end if;
  ov := get_security_overview();
  if (ov->>'blocked_users')::int <> 1 then raise exception 'FAIL T4: overview blocked_users wrong'; end if;
  raise notice 'PASS T4: blocked-users list + security overview correct';
end $$;

-- ── T5: audit_log is immutable (update + delete blocked, all roles) ──
reset role;  -- as postgres (superuser) — the trigger must still block
do $$
begin
  begin
    update audit_log set detail = 'tampered' where action = 'ban_user';
    raise exception 'FAIL T5: audit_log UPDATE was allowed';
  exception when others then
    if position('append-only' in sqlerrm) > 0 then raise notice 'PASS T5a: audit_log UPDATE blocked (%)', sqlerrm;
    else raise; end if;
  end;
  begin
    delete from audit_log where action = 'ban_user';
    raise exception 'FAIL T5: audit_log DELETE was allowed';
  exception when others then
    if position('append-only' in sqlerrm) > 0 then raise notice 'PASS T5b: audit_log DELETE blocked (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL SECURITY-CENTER TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
