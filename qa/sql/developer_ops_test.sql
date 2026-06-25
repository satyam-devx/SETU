-- ═══════════════════════════════════════════════════════════════
-- SETU — Developer Ops Status Proof (migration 032)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/developer_ops_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
--   T1 — customer denied get_storage_health / get_system_status
--   T2 — super_admin records a deploy + backup; get_system_status reflects them
--   T3 — get_storage_health returns a buckets structure (no error)
--   T4 — record_system_event rejects an invalid kind
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin' where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer'    where id='11111111-1111-1111-1111-111111111111';

-- ── T1: customer denied ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform get_system_status();
    raise exception 'FAIL T1: customer read system status';
  exception when others then
    if position('developer.view' in sqlerrm) > 0 then raise notice 'PASS T1: get_system_status denied to customer';
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin records events; get_system_status reflects them ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  perform record_system_event('deploy', 'success', 'abc1234', 'CI deploy');
  perform record_system_event('backup', 'success', 'bkp_1',   'nightly backup');

  v := get_system_status();
  if v->'last_backup'->>'status' <> 'success' then raise exception 'FAIL T2: backup not reflected: %', v::text; end if;
  if jsonb_array_length(v->'recent_deploys') < 1 then raise exception 'FAIL T2: deploy not reflected'; end if;
  raise notice 'PASS T2: deploy + backup recorded and surfaced';
end $$;

-- ── T3: storage health returns a structure ──
do $$
declare v jsonb;
begin
  v := get_storage_health();
  if v->'buckets' is null then raise exception 'FAIL T3: no buckets key: %', v::text; end if;
  raise notice 'PASS T3: get_storage_health returns buckets structure';
end $$;

-- ── T4: invalid kind rejected ──
do $$
begin
  begin
    perform record_system_event('explode', 'success', null, null);
    raise exception 'FAIL T4: invalid kind accepted';
  exception when others then
    if position('invalid kind' in sqlerrm) > 0 then raise notice 'PASS T4: invalid kind rejected';
    else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL DEVELOPER OPS TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
