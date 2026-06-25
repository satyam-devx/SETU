-- ═══════════════════════════════════════════════════════════════
-- SETU — Feature Flags Proof (migration 022)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/feature_flags_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','cust@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now());
update profiles set role='customer'    where id='11111111-1111-1111-1111-111111111111';
update profiles set role='super_admin' where id='99999999-9999-9999-9999-999999999999';

-- ── T1: unknown flag defaults ON (not gated) ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  if not is_feature_enabled('a_flag_that_does_not_exist') then
    raise exception 'FAIL T1: unknown flag should default ON';
  end if;
  if not is_feature_enabled('wallet') then
    raise exception 'FAIL T1: seeded wallet flag should be ON by default';
  end if;
  raise notice 'PASS T1: unknown flag defaults ON; seeded wallet ON';
end $$;

-- ── T2: a customer cannot flip a flag (needs feature_flags.manage) ──
do $$
begin
  begin
    perform set_feature_flag('wallet', false);
    raise exception 'FAIL T2: customer was allowed to change a feature flag';
  exception when others then
    if position('feature_flags.manage' in sqlerrm) > 0 then raise notice 'PASS T2: set_feature_flag denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T3: super_admin disables a flag → evaluation flips + audited ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb; n int;
begin
  v := set_feature_flag('wallet', false);
  if not (v->>'success')::boolean then raise exception 'FAIL T3: disable failed: %', v::text; end if;
  if is_feature_enabled('wallet') then raise exception 'FAIL T3: wallet still enabled after disable'; end if;
  reset role;
  select count(*) into n from audit_log where action='feature_flag_disabled' and target='wallet';
  if n < 1 then raise exception 'FAIL T3: disable not audit-logged'; end if;
  raise notice 'PASS T3: super_admin disabled wallet; evaluation OFF + audit-logged';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T4: audience targeting (vendor-only) hides from a customer ──
do $$
begin
  perform upsert_feature_flag('ai', 'AI Assistant', 'test', true, 100, '{"roles":["vendor"]}'::jsonb);
end $$;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  if is_feature_enabled('ai') then
    raise exception 'FAIL T4: vendor-only flag should be OFF for a customer';
  end if;
  raise notice 'PASS T4: audience targeting hides vendor-only flag from customer';
end $$;

-- ── T5: direct table write denied (RPC-only) ──
do $$
begin
  begin
    insert into feature_flags (key, name) values ('hack_flag', 'Hack');
    raise exception 'FAIL T5: direct feature_flags INSERT was allowed';
  exception
    when insufficient_privilege then raise notice 'PASS T5: direct feature_flags INSERT denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T5: direct feature_flags INSERT denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL FEATURE-FLAG TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
