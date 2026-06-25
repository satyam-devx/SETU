-- ═══════════════════════════════════════════════════════════════
-- SETU — Application Settings Proof (migration 023)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/settings_test.sql
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

-- ── T1: public settings expose branding but NOT admin-only fees ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
declare pub jsonb;
begin
  pub := get_public_settings();
  if pub->>'platform_name' is null then raise exception 'FAIL T1: platform_name not public'; end if;
  if pub ? 'platform_commission_pct' then raise exception 'FAIL T1: admin-only fee leaked to public settings'; end if;
  if get_setting('platform_commission_pct') is not null then raise exception 'FAIL T1: customer read an admin-only setting'; end if;
  raise notice 'PASS T1: public settings expose branding, hide admin-only fees';
end $$;

-- ── T2: a customer cannot write settings ──
do $$
begin
  begin
    perform set_setting('platform_name', 'Hacked');
    raise exception 'FAIL T2: customer was allowed to change a setting';
  exception when others then
    if position('settings.update' in sqlerrm) > 0 then raise notice 'PASS T2: set_setting denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T3: super_admin updates a setting → persisted + audited ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb; n int;
begin
  v := set_setting('platform_name', 'SETU Bharat');
  if not (v->>'success')::boolean then raise exception 'FAIL T3: update failed: %', v::text; end if;
  if get_setting('platform_name') <> 'SETU Bharat' then raise exception 'FAIL T3: value not persisted'; end if;
  reset role;
  select count(*) into n from audit_log where action='setting_updated' and target='platform_name';
  if n < 1 then raise exception 'FAIL T3: update not audit-logged'; end if;
  raise notice 'PASS T3: super_admin update persisted + audit-logged';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T4: type validation rejects bad values ──
do $$
begin
  begin
    perform set_setting('platform_commission_pct', 'not-a-number');
    raise exception 'FAIL T4: non-numeric value accepted for a number setting';
  exception when others then
    if position('must be a number' in sqlerrm) > 0 then raise notice 'PASS T4: number validation enforced (%)', sqlerrm;
    else raise; end if;
  end;

  begin
    perform set_setting('primary_color', 'red');
    raise exception 'FAIL T4: invalid colour accepted';
  exception when others then
    if position('hex colour' in sqlerrm) > 0 then raise notice 'PASS T4b: colour validation enforced (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T5: direct table write denied (RPC-only) ──
do $$
begin
  begin
    update platform_config set value = '0' where key = 'platform_commission_pct';
    raise exception 'FAIL T5: direct platform_config UPDATE was allowed';
  exception
    when insufficient_privilege then raise notice 'PASS T5: direct platform_config UPDATE denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T5: direct platform_config UPDATE denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL APPLICATION-SETTINGS TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
