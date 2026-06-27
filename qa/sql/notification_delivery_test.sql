-- ═══════════════════════════════════════════════════════════════
-- SETU — Multi-channel Delivery Proof (migration 034)
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f qa/sql/notification_delivery_test.sql
--
-- Runs in one transaction, ends with ROLLBACK (non-destructive).
--   T1 — sms campaign rejected while sms_enabled=false
--   T2 — enabled + dispatched sms campaign enqueues deliveries;
--        recipients with a phone → pending, without → skipped
--   T3 — claim_pending_deliveries requires service_role
--   T4 — mark_delivery transitions + get_delivery_stats counts
-- ═══════════════════════════════════════════════════════════════

begin;

insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at, email_confirmed_at)
values
  ('00000000-0000-0000-0000-000000000000','99999999-9999-9999-9999-999999999999','authenticated','authenticated','super@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','c1@test.local','{}','{}', now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','c2@test.local','{}','{}', now(), now(), now());
update profiles set role='super_admin', name='Super', phone='9001110001' where id='99999999-9999-9999-9999-999999999999';
update profiles set role='customer',    name='HasPhone', phone='9001110002' where id='11111111-1111-1111-1111-111111111111';
update profiles set role='customer',    name='NoPhone',  phone=null         where id='22222222-2222-2222-2222-222222222222';

-- ── T1: sms campaign rejected when channel disabled ──
update platform_config set value='false' where key='sms_enabled';
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
begin
  begin
    perform create_campaign('Promo','sms','Hi','Sale today', 'promo', '{"roles":["customer"]}'::jsonb, null);
    raise exception 'FAIL T1: sms campaign created while disabled';
  exception when others then
    if position('SMS channel is disabled' in sqlerrm) > 0 then raise notice 'PASS T1: disabled channel rejected';
    else raise; end if;
  end;
end $$;

-- ── T2: enable + dispatch enqueues deliveries (pending vs skipped) ──
-- platform_config has no write RLS policy (writes go via RPC only), so the
-- toggle must be done as postgres, not as the authenticated caller.
reset role;
update platform_config set value='true' where key='sms_enabled';
set local role authenticated;
do $$
declare v jsonb; v_id uuid; v_pending int; v_skipped int;
begin
  v := create_campaign('Promo','sms','Hi','Sale today', 'promo', '{"roles":["customer"]}'::jsonb, null);
  if not (v->>'success')::boolean then raise exception 'FAIL T2: create failed: %', v::text; end if;
  v_id := (v->>'id')::uuid;

  v := dispatch_campaign(v_id);
  if not (v->>'success')::boolean then raise exception 'FAIL T2: dispatch failed: %', v::text; end if;

  reset role;
  select count(*) filter (where status='pending'),
         count(*) filter (where status='skipped')
    into v_pending, v_skipped
  from notification_deliveries where campaign_id = v_id;

  if v_pending <> 1 then raise exception 'FAIL T2: expected 1 pending (HasPhone), got %', v_pending; end if;
  if v_skipped <> 1 then raise exception 'FAIL T2: expected 1 skipped (NoPhone), got %', v_skipped; end if;
  raise notice 'PASS T2: deliveries enqueued (1 pending, 1 skipped)';
end $$;

-- ── T3: claim requires service_role ──
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
begin
  begin
    perform claim_pending_deliveries(10);
    raise exception 'FAIL T3: non-service-role claimed deliveries';
  exception when others then
    if position('service_role required' in sqlerrm) > 0 then raise notice 'PASS T3: claim restricted to service_role';
    else raise; end if;
  end;
end $$;

-- ── T4: worker claims, marks, stats reflect ──
-- Simulate a service_role caller: claim_pending_deliveries/mark_delivery
-- gate on auth.role() (the JWT role claim), not the DB role.
reset role;
set local request.jwt.claims = '{"role":"service_role"}';
set local role service_role;
do $$
declare r record; v_marked int := 0;
begin
  for r in select * from claim_pending_deliveries(10) loop
    perform mark_delivery(r.id, 'sent', 'twilio', 'SM_test', null);
    v_marked := v_marked + 1;
  end loop;
  if v_marked <> 1 then raise exception 'FAIL T4: expected to claim 1 pending, claimed %', v_marked; end if;
end $$;
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-9999-9999-999999999999","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := get_delivery_stats();
  if (v->>'sent')::int <> 1    then raise exception 'FAIL T4: sent expected 1, got %', v->>'sent'; end if;
  if (v->>'skipped')::int <> 1 then raise exception 'FAIL T4: skipped expected 1, got %', v->>'skipped'; end if;
  raise notice 'PASS T4: worker contract + delivery stats correct';
end $$;

reset role;

do $$
begin
  raise notice '═══════════════════════════════════════════';
  raise notice '  ✅ ALL NOTIFICATION DELIVERY TESTS PASSED';
  raise notice '═══════════════════════════════════════════';
end $$;

rollback;
