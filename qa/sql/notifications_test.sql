-- ═══════════════════════════════════════════════════════════════
-- SETU — Notification Center Proof (migration 024)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/notifications_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','c2@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','v1@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin' where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer'    where id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
update profiles set role='vendor'       where id='33333333-3333-3333-3333-333333333333';

-- ── T1: a customer cannot create a campaign ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$
begin
  begin
    perform create_campaign('Hack', 'in_app', 'x', 'y', 'promo', '{}'::jsonb, null);
    raise exception 'FAIL T1: customer created a campaign';
  exception when others then
    if position('notifications.create' in sqlerrm) > 0 then raise notice 'PASS T1: create_campaign denied to customer (%)', sqlerrm;
    else raise; end if;
  end;
end $$;

-- ── T2: super_admin role-targeted campaign delivers in-app + audits ──
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb; cid uuid; n int;
begin
  v := create_campaign('Customers promo', 'in_app', 'Hello customers', 'Big sale!', 'promo', '{"roles":["customer"]}'::jsonb, null);
  if (v->>'targeted')::int <> 2 then raise exception 'FAIL T2: expected 2 customers targeted, got %', v->>'targeted'; end if;
  cid := (v->>'id')::uuid;

  v := dispatch_campaign(cid);
  if not (v->>'success')::boolean then raise exception 'FAIL T2: dispatch failed: %', v::text; end if;

  reset role;
  select count(*) into n from notifications where title='Hello customers';
  if n <> 2 then raise exception 'FAIL T2: expected 2 in-app notifications, got %', n; end if;
  select count(*) into n from notification_campaigns where id=cid and status='sent';
  if n <> 1 then raise exception 'FAIL T2: campaign not marked sent'; end if;
  select count(*) into n from audit_log where action='campaign_dispatched' and target=cid::text;
  if n < 1 then raise exception 'FAIL T2: dispatch not audited'; end if;
  raise notice 'PASS T2: role-targeted campaign delivered to 2 customers + audited';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T3: targeting excludes non-matching roles ──
do $$
declare v jsonb; cid uuid; n int;
begin
  v := create_campaign('Vendors only', 'in_app', 'Vendor notice', 'For vendors', 'system', '{"roles":["vendor"]}'::jsonb, null);
  if (v->>'targeted')::int <> 1 then raise exception 'FAIL T3: expected 1 vendor, got %', v->>'targeted'; end if;
  cid := (v->>'id')::uuid;
  perform dispatch_campaign(cid);
  reset role;
  select count(*) into n from notifications where title='Vendor notice' and user_id='33333333-3333-3333-3333-333333333333';
  if n <> 1 then raise exception 'FAIL T3: vendor did not receive notice'; end if;
  select count(*) into n from notifications where title='Vendor notice' and user_id in ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222');
  if n <> 0 then raise exception 'FAIL T3: customers wrongly received vendor-only notice'; end if;
  raise notice 'PASS T3: audience targeting excludes non-matching roles';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T4: push cannot be scheduled; in_app schedule + cron dispatch works ──
do $$
declare v jsonb; cid uuid; n int;
begin
  begin
    perform create_campaign('Sched push', 'push', 't', 'b', 'promo', '{}'::jsonb, now() + interval '1 hour');
    raise exception 'FAIL T4: push campaign was schedulable';
  exception when others then
    if position('can be scheduled' in sqlerrm) > 0 then raise notice 'PASS T4a: scheduled push correctly rejected (%)', sqlerrm;
    else raise; end if;
  end;

  v := create_campaign('Sched inapp', 'in_app', 'Scheduled hello', 'soon', 'system', '{"roles":["customer"]}'::jsonb, now() + interval '1 hour');
  if v->>'status' <> 'scheduled' then raise exception 'FAIL T4: in_app schedule not marked scheduled'; end if;
  cid := (v->>'id')::uuid;

  reset role;  -- as postgres: backdate the schedule and run the cron worker
  update notification_campaigns set scheduled_at = now() - interval '1 minute' where id = cid;
  perform dispatch_due_campaigns();
  select count(*) into n from notification_campaigns where id=cid and status='sent';
  if n <> 1 then raise exception 'FAIL T4: scheduled campaign not dispatched by cron worker'; end if;
  select count(*) into n from notifications where title='Scheduled hello';
  if n <> 2 then raise exception 'FAIL T4: scheduled campaign delivered to wrong count (%)', n; end if;
  raise notice 'PASS T4b: in_app campaign scheduled + dispatched by cron worker to 2 customers';
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
end $$;

-- ── T5: direct table write denied (RPC-only) ──
do $$
begin
  begin
    insert into notification_campaigns (name, title, body) values ('hack', 't', 'b');
    raise exception 'FAIL T5: direct campaign INSERT was allowed';
  exception
    when insufficient_privilege then raise notice 'PASS T5: direct campaign INSERT denied by RLS';
    when others then
      if sqlstate = '42501' then raise notice 'PASS T5: direct campaign INSERT denied (%)', sqlerrm;
      else raise; end if;
  end;
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL NOTIFICATION-CENTER TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
