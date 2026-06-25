-- ═══════════════════════════════════════════════════════════════
-- SETU — Dynamic RBAC Proof (migration 021)
--
-- Executable evidence that authorization is database-driven and that
-- the management RPCs are super-admin-only and audited.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/rbac_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','88888888-8888-8888-8888-888888888888','authenticated','authenticated','admin@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now());

update profiles set role='admin'       where id='88888888-8888-8888-8888-888888888888';
update profiles set role='super_admin' where id='99999999-9999-9999-9999-999999999999';

-- ── T1: admin permission set is real, scoped, and excludes the dangerous bits ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}';
do $$
declare perms text[];
begin
  perms := current_user_permissions();
  if array_length(perms, 1) is null or array_length(perms, 1) = 0 then
    raise exception 'FAIL T1: admin has no permissions';
  end if;
  if not has_permission('orders.view') then raise exception 'FAIL T1: admin lacks orders.view'; end if;
  if has_permission('roles.update')     then raise exception 'FAIL T1: admin should NOT have roles.update'; end if;
  if has_permission('users.grant')      then raise exception 'FAIL T1: admin should NOT have *.grant'; end if;
  if has_permission('settings.manage')  then raise exception 'FAIL T1: admin should NOT have settings.manage'; end if;
  raise notice 'PASS T1: admin permission set is DB-driven and correctly scoped (% perms)', array_length(perms,1);
end $$;

-- ── T2: super_admin implicitly holds everything ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare perms text[];
begin
  if not has_permission('roles.grant') then raise exception 'FAIL T2: super_admin missing implicit permission'; end if;
  perms := current_user_permissions();
  if array_length(perms,1) < (select count(*) from permissions) then
    raise exception 'FAIL T2: super_admin should hold all % permissions, got %', (select count(*) from permissions), array_length(perms,1);
  end if;
  raise notice 'PASS T2: super_admin implicitly holds all % permissions', array_length(perms,1);
end $$;

-- ── T3: management RPC is super-admin only ──
set local request.jwt.claims = '{"sub":"88888888-8888-8888-8888-888888888888","role":"authenticated"}';
do $$
begin
  begin
    perform set_role_permission('rider', 'orders.view', true);
    raise exception 'FAIL T3: admin was allowed to change role permissions';
  exception when others then
    if position('super_admin' in sqlerrm) > 0 then raise notice 'PASS T3: set_role_permission denied to admin (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T4: super_admin can grant, it persists, and it's audited ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb; n int;
begin
  v := set_role_permission('rider', 'orders.view', true);
  if not (v->>'success')::boolean then raise exception 'FAIL T4: grant failed: %', v::text; end if;
  reset role;  -- read back as postgres
  select count(*) into n from role_permissions where role_key='rider' and permission_key='orders.view';
  if n <> 1 then raise exception 'FAIL T4: grant not persisted'; end if;
  select count(*) into n from audit_log where action='permission_granted' and target='rider';
  if n < 1 then raise exception 'FAIL T4: grant not audit-logged'; end if;
  raise notice 'PASS T4: super_admin grant persisted + audit-logged';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T5: super_admin role itself cannot be modified ──
do $$
begin
  begin
    perform set_role_permission('super_admin', 'orders.view', false);
    raise exception 'FAIL T5: super_admin role was modifiable';
  exception when others then
    if position('cannot be modified' in sqlerrm) > 0 then raise notice 'PASS T5: super_admin role is immutable (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T6: direct table writes are denied (RPC-only) ──
do $$
begin
  begin
    insert into role_permissions (role_key, permission_key) values ('rider', 'wallet.manage');
    raise exception 'FAIL T6: direct role_permissions INSERT was allowed';
  exception
    when insufficient_privilege then raise notice 'PASS T6: direct role_permissions INSERT denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T6: direct role_permissions INSERT denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL DYNAMIC-RBAC TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
