-- ═══════════════════════════════════════════════════════════════
-- SETU — Developer Center Proof (migration 027)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/developer_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin' where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer'    where id='11111111-1111-1111-1111-111111111111';

-- ── T1: a customer cannot read developer dashboards ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform get_developer_overview();
    raise exception 'FAIL T1: customer read the developer overview';
  exception when others then
    if position('developer.view' in sqlerrm) > 0 then raise notice 'PASS T1: developer overview denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin overview returns live signals ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare ov jsonb;
begin
  ov := get_developer_overview();
  if ov->>'db_size' is null then raise exception 'FAIL T2: overview missing db_size'; end if;
  if (ov->>'cron_jobs')::int < 1 then raise exception 'FAIL T2: expected cron jobs to exist'; end if;
  raise notice 'PASS T2: developer overview live (db_size=%, cron_jobs=%)', ov->>'db_size', ov->>'cron_jobs';
end $$;

-- ── T3: cron jobs list includes our scheduled workers ──
do $$
declare jobs jsonb; n int;
begin
  jobs := get_cron_jobs();
  n := jsonb_array_length(jobs);
  if n < 1 then raise exception 'FAIL T3: no cron jobs returned'; end if;
  if not (jobs::text like '%dispatch-due-campaigns%') then
    raise exception 'FAIL T3: expected dispatch-due-campaigns job in list';
  end if;
  raise notice 'PASS T3: % cron jobs surfaced (incl. our workers)', n;
end $$;

-- ── T4: migration status reflects applied migrations ──
do $$
declare ms jsonb;
begin
  ms := get_migration_status();
  if (ms->>'count')::int < 1 then raise exception 'FAIL T4: no migrations reported'; end if;
  if ms->>'latest' is null then raise exception 'FAIL T4: latest migration null'; end if;
  raise notice 'PASS T4: % migrations applied, latest %', ms->>'count', ms->>'latest';
end $$;

-- ── T5: database health returns per-table sizes ──
do $$
declare dh jsonb;
begin
  dh := get_database_health();
  if jsonb_array_length(dh->'tables') < 1 then raise exception 'FAIL T5: no tables in db health'; end if;
  raise notice 'PASS T5: db health returns % tables, size %', jsonb_array_length(dh->'tables'), dh->>'db_size';
end $$;

-- ── T6: customer cannot read cron jobs ──
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform get_cron_jobs();
    raise exception 'FAIL T6: customer read cron jobs';
  exception when others then
    if position('developer.view' in sqlerrm) > 0 then raise notice 'PASS T6: cron jobs denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL DEVELOPER-CENTER TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
